/**
 * Import full Shopify order history from CSV export.
 * Run: npx tsx scripts/import-csv-history.ts
 */

import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";

const CSV_PATH = "/Users/nguyendinhhuy/Downloads/orders_export_1.csv";

// ── CSV parser (handles quoted fields with commas/newlines) ──────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuote = false;
  // normalise line endings
  const t = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQuote) {
      if (ch === '"' && t[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field); field = ""; rows.push(row); row = []; }
      else { field += ch; }
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  console.log("📂 Reading CSV...");
  const text = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(text);
  console.log(`   ${rows.length} rows parsed`);

  const header = rows[0].map(h => h.trim());
  const col = (name: string) => header.indexOf(name);

  // Key column indices
  const C = {
    name:              col("Name"),
    email:             col("Email"),
    financialStatus:   col("Financial Status"),
    fulfillmentStatus: col("Fulfillment Status"),
    createdAt:         col("Created at"),
    total:             col("Total"),
    source:            col("Source"),
    shopifyId:         col("Id"),
    cancelledAt:       col("Cancelled at"),
    // Line item
    liQty:   col("Lineitem quantity"),
    liName:  col("Lineitem name"),
    liPrice: col("Lineitem price"),
    liSku:   col("Lineitem sku"),
  };

  console.log("   Columns found:", JSON.stringify({
    name: C.name, createdAt: C.createdAt, shopifyId: C.shopifyId, liSku: C.liSku
  }));

  // ── Group rows by order name ─────────────────────────────────────────────
  interface OrderAccum {
    orderName: string;
    email: string;
    financialStatus: string;
    fulfillmentStatus: string;
    createdAt: string;
    total: string;
    source: string;
    shopifyNumericId: string;
    cancelledAt: string;
    lineItems: { sku: string; title: string; quantity: number; price: string }[];
  }

  const orderMap = new Map<string, OrderAccum>();
  let currentName = "";

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 5) continue;

    const nameCell = (r[C.name] ?? "").trim();
    if (nameCell) currentName = nameCell;
    if (!currentName) continue;

    if (!orderMap.has(currentName)) {
      orderMap.set(currentName, {
        orderName:        currentName,
        email:            (r[C.email] ?? "").trim(),
        financialStatus:  (r[C.financialStatus] ?? "paid").trim() || "paid",
        fulfillmentStatus:(r[C.fulfillmentStatus] ?? "").trim(),
        createdAt:        (r[C.createdAt] ?? "").trim(),
        total:            (r[C.total] ?? "0").trim(),
        source:           (r[C.source] ?? "csv-import").trim() || "csv-import",
        shopifyNumericId: (r[C.shopifyId] ?? "").trim(),
        cancelledAt:      (r[C.cancelledAt] ?? "").trim(),
        lineItems: [],
      });
    }

    // Always add line item (every row has one)
    const qty   = parseFloat((r[C.liQty]   ?? "0").trim()) || 0;
    const title = (r[C.liName]  ?? "").trim();
    const price = (r[C.liPrice] ?? "0").trim();
    const sku   = (r[C.liSku]   ?? "").trim();

    if (qty > 0 && title) {
      orderMap.get(currentName)!.lineItems.push({ sku, title, quantity: qty, price });
    }
  }

  console.log(`\n📦 ${orderMap.size} unique orders found in CSV`);

  // ── Date range stats ─────────────────────────────────────────────────────
  const dates = [...orderMap.values()]
    .map(o => o.createdAt)
    .filter(d => d)
    .sort();
  console.log(`   Oldest: ${dates[0]}`);
  console.log(`   Newest: ${dates[dates.length - 1]}`);

  // ── Upsert into ShopifyOrder ─────────────────────────────────────────────
  console.log("\n⬆️  Importing into database...");

  let created = 0, updated = 0, skipped = 0, errors = 0;
  const BATCH = 50;
  const allOrders = [...orderMap.values()];

  for (let i = 0; i < allOrders.length; i += BATCH) {
    const batch = allOrders.slice(i, i + BATCH);

    await Promise.all(batch.map(async (o) => {
      try {
        // Parse date — format: "2019-05-21 18:06:17 -0500"
        let createdDate: Date;
        try { createdDate = new Date(o.createdAt); }
        catch { createdDate = new Date(); }
        if (isNaN(createdDate.getTime())) createdDate = new Date();

        const totalUsd = parseFloat(o.total) || 0;
        const lineItemsJson = JSON.stringify(o.lineItems);

        // shopifyId: prefer real numeric ID, fallback to "csv-{name}"
        const shopifyId = o.shopifyNumericId || `csv-${o.orderName}`;

        const existing = await prisma.shopifyOrder.findUnique({
          where: { shopifyId },
          select: { id: true },
        });

        if (existing) {
          await prisma.shopifyOrder.update({
            where: { shopifyId },
            data: {
              financialStatus:   o.financialStatus,
              fulfillmentStatus: o.fulfillmentStatus || null,
              totalPriceUsd:     totalUsd,
              lineItemsJson,
              syncedAt:          new Date(),
            },
          });
          updated++;
        } else {
          // Also check by orderName (might be already stored with different shopifyId)
          const byName = await prisma.shopifyOrder.findFirst({
            where: { orderName: o.orderName },
            select: { id: true, shopifyId: true },
          });

          if (byName) {
            // Update existing record
            await prisma.shopifyOrder.update({
              where: { id: byName.id },
              data: { lineItemsJson, syncedAt: new Date() },
            });
            updated++;
          } else {
            await prisma.shopifyOrder.create({
              data: {
                shopifyId,
                orderName:         o.orderName,
                email:             o.email,
                financialStatus:   o.financialStatus,
                fulfillmentStatus: o.fulfillmentStatus || null,
                totalPriceUsd:     totalUsd,
                lineItemsJson,
                sourceName:        o.source || "csv-import",
                paymentGateway:    "",
                createdAtShopify:  createdDate,
                syncedAt:          new Date(),
              },
            });
            created++;
          }
        }
      } catch (e) {
        errors++;
        console.error(`  ❌ ${o.orderName}:`, e instanceof Error ? e.message : e);
      }
    }));

    // Progress
    const done = Math.min(i + BATCH, allOrders.length);
    process.stdout.write(`\r   ${done}/${allOrders.length} (${Math.round(done/allOrders.length*100)}%)`);
  }

  console.log("\n");
  console.log("✅ Import complete:");
  console.log(`   Created : ${created}`);
  console.log(`   Updated : ${updated}`);
  console.log(`   Skipped : ${skipped}`);
  console.log(`   Errors  : ${errors}`);
  console.log(`   Total DB orders now:`);

  const totalInDb = await prisma.shopifyOrder.count();
  const oldest = await prisma.shopifyOrder.findFirst({ orderBy: { createdAtShopify: "asc" }, select: { createdAtShopify: true, orderName: true } });
  const newest = await prisma.shopifyOrder.findFirst({ orderBy: { createdAtShopify: "desc" }, select: { createdAtShopify: true, orderName: true } });
  console.log(`   ${totalInDb} orders`);
  console.log(`   ${oldest?.orderName} (${oldest?.createdAtShopify?.toISOString().slice(0,10)}) → ${newest?.orderName} (${newest?.createdAtShopify?.toISOString().slice(0,10)})`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
