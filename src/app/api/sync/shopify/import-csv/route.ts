import { prisma } from "@/lib/prisma";

// ─── CSV parser ───────────────────────────────────────────────────────────────

/** Parse a single CSV line respecting quoted fields (may contain commas). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Parse full CSV text into an array of row objects keyed by header names. */
function parseCsv(text: string): Record<string, string>[] {
  // Normalise line endings
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Find first non-empty line as header
  const headerLine = lines.find((l) => l.trim().length > 0);
  if (!headerLine) return [];

  const headers = parseCsvLine(headerLine);
  const headerIndex = lines.indexOf(headerLine);

  const rows: Record<string, string>[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  sku: string;
  title: string;
  quantity: number;
  price: number;
}

interface OrderAccumulator {
  orderName: string;
  email: string;
  financialStatus: string;
  fulfillmentStatus: string;
  totalPriceUsd: number;
  createdAtShopify: Date;
  lineItems: LineItem[];
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsv(text);

    if (rows.length === 0) {
      return Response.json({ error: "CSV is empty or unreadable" }, { status: 400 });
    }

    // ── Group rows by order (carry forward Name when blank) ──────────────────
    const orderMap = new Map<string, OrderAccumulator>();
    let lastOrderName = "";

    for (const row of rows) {
      const rawName = row["Name"] ?? "";
      const orderName = rawName.trim() !== "" ? rawName.trim() : lastOrderName;
      if (!orderName) continue;
      lastOrderName = orderName;

      if (!orderMap.has(orderName)) {
        const rawCreated = row["Created at"] ?? "";
        const createdAt = rawCreated ? new Date(rawCreated) : new Date();

        orderMap.set(orderName, {
          orderName,
          email: row["Email"] ?? "",
          financialStatus: row["Financial Status"] ?? "",
          fulfillmentStatus: row["Fulfillment Status"] ?? "",
          totalPriceUsd: parseFloat(row["Total"] ?? "0") || 0,
          createdAtShopify: isNaN(createdAt.getTime()) ? new Date() : createdAt,
          lineItems: [],
        });
      }

      const order = orderMap.get(orderName)!;

      const itemTitle = row["Lineitem name"] ?? "";
      const itemSku = row["Lineitem sku"] ?? "";
      const itemQty = parseInt(row["Lineitem quantity"] ?? "0", 10) || 0;
      const itemPrice = parseFloat(row["Lineitem price"] ?? "0") || 0;

      if (itemTitle || itemSku) {
        order.lineItems.push({
          sku: itemSku,
          title: itemTitle,
          quantity: itemQty,
          price: itemPrice,
        });
      }
    }

    // ── Upsert each order ────────────────────────────────────────────────────
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let oldestOrder: Date | null = null;
    let newestOrder: Date | null = null;

    for (const [, order] of orderMap) {
      // Track date range
      if (!oldestOrder || order.createdAtShopify < oldestOrder) {
        oldestOrder = order.createdAtShopify;
      }
      if (!newestOrder || order.createdAtShopify > newestOrder) {
        newestOrder = order.createdAtShopify;
      }

      const csvShopifyId = `csv-${order.orderName}`;
      const lineItemsJson = JSON.stringify(order.lineItems);

      // Check if a real (numeric) shopifyId already exists for this orderName.
      // Real records have shopifyId that does NOT start with "csv-".
      const realRecord = await prisma.shopifyOrder.findFirst({
        where: {
          orderName: order.orderName,
          NOT: { shopifyId: { startsWith: "csv-" } },
        },
        select: { id: true },
      });

      if (realRecord) {
        // Update only lineItemsJson on the real record; skip creating a duplicate.
        await prisma.shopifyOrder.update({
          where: { id: realRecord.id },
          data: { lineItemsJson },
        });
        skipped++;
        continue;
      }

      // Check whether the csv- record already exists to distinguish create vs update.
      const csvRecord = await prisma.shopifyOrder.findUnique({
        where: { shopifyId: csvShopifyId },
        select: { id: true },
      });

      await prisma.shopifyOrder.upsert({
        where: { shopifyId: csvShopifyId },
        update: {
          email: order.email,
          financialStatus: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          totalPriceUsd: order.totalPriceUsd,
          lineItemsJson,
          syncedAt: new Date(),
        },
        create: {
          shopifyId: csvShopifyId,
          orderName: order.orderName,
          email: order.email,
          financialStatus: order.financialStatus,
          fulfillmentStatus: order.fulfillmentStatus,
          totalPriceUsd: order.totalPriceUsd,
          lineItemsJson,
          sourceName: "csv-import",
          paymentGateway: "",
          createdAtShopify: order.createdAtShopify,
          syncedAt: new Date(),
        },
      });

      if (csvRecord) {
        updated++;
      } else {
        created++;
      }
    }

    const total = orderMap.size;

    return Response.json({
      ok: true,
      total,
      created,
      updated,
      skipped,
      oldestOrder: oldestOrder?.toISOString() ?? null,
      newestOrder: newestOrder?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[import-csv] error:", err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
