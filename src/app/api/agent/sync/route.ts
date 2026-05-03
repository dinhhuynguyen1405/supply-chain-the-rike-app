/**
 * /api/agent/sync
 * ─────────────────────────────────────────────────────────────────────────────
 * Smart Sync Agent — tự động phát hiện và sửa các sai lệch giữa app và Shopify.
 *
 * POST body: { action: string, options?: object }
 *
 * Actions:
 *   "check"           → Kiểm tra toàn bộ, báo cáo sai lệch (không thay đổi gì)
 *   "fix_inventory"   → Đẩy đúng tổng (nhungQty + brosQty) lên Shopify cho tất cả sản phẩm
 *   "fix_one"         → Đẩy inventory cho 1 sản phẩm: { options: { productId } }
 *   "push_all_sheets" → Sync toàn bộ sheet Google Sheets
 *   "init_nhung"      → Khởi tạo nhungQty = Shopify qty hiện tại (dùng 1 lần đầu)
 */

import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  getShopifyConfig,
  getVariantMap,
  getLocationId,
  getInventoryLevels,
  pushTotalInventory,
} from "@/lib/shopify";
import { triggerSheetSync } from "@/lib/sync-trigger";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MismatchReport {
  productId: string;
  nameVi: string | null;
  name: string;
  skuShopify: string;
  nhungQty: number;
  brosQty: number;
  expectedShopify: number;
  actualShopify: number;
  diff: number; // expected - actual
}

interface AgentResult {
  action: string;
  ok: boolean;
  summary: string;
  details?: unknown;
  errors?: string[];
  timestamp: string;
}

// ─── POST /api/agent/sync ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action: string = body.action ?? "check";
  const options: Record<string, unknown> = body.options ?? {};

  const timestamp = new Date().toISOString();
  const errors: string[] = [];

  // ── Lấy cấu hình Shopify ──────────────────────────────────────────────────
  const cfg = await getShopifyConfig();

  // ── ACTION: check ─────────────────────────────────────────────────────────
  if (action === "check") {
    if (!cfg) {
      return Response.json({
        action,
        ok: false,
        summary: "Chưa cấu hình Shopify",
        timestamp,
      } satisfies AgentResult);
    }

    const [products, brosStocks, variantMap, locationId] = await Promise.all([
      prisma.product.findMany({
        where: { skuShopify: { not: null } },
        select: { id: true, name: true, nameVi: true, skuShopify: true, skuAmz: true, nhungQty: true },
      }),
      prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
      getVariantMap(cfg),
      getLocationId(cfg),
    ]);

    // Build bros map
    const brosMap: Record<string, number> = {};
    for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

    // Lấy inventory levels từ Shopify
    const inventoryItemIds = products
      .map((p) => variantMap[p.skuShopify!]?.inventoryItemId)
      .filter(Boolean) as string[];

    const shopifyLevels = locationId
      ? await getInventoryLevels(cfg, inventoryItemIds, locationId)
      : {};

    const mismatches: MismatchReport[] = [];
    let totalOk = 0;

    for (const p of products) {
      if (!p.skuShopify) continue;
      const variant = variantMap[p.skuShopify];
      if (!variant) continue;

      const brosQty = (p.skuAmz ? brosMap[p.skuAmz] : null) ?? brosMap[p.skuShopify] ?? 0;
      const expected = Math.round(p.nhungQty + brosQty);
      const actual = shopifyLevels[variant.inventoryItemId] ?? 0;

      if (Math.abs(expected - actual) > 0) {
        mismatches.push({
          productId: p.id,
          nameVi: p.nameVi,
          name: p.name,
          skuShopify: p.skuShopify,
          nhungQty: p.nhungQty,
          brosQty,
          expectedShopify: expected,
          actualShopify: actual,
          diff: expected - actual,
        });
      } else {
        totalOk++;
      }
    }

    return Response.json({
      action,
      ok: true,
      summary: mismatches.length === 0
        ? `✅ Tất cả ${totalOk} sản phẩm đều đồng bộ với Shopify`
        : `⚠ ${mismatches.length} sản phẩm sai lệch, ${totalOk} sản phẩm OK`,
      details: { totalOk, mismatches },
      timestamp,
    } satisfies AgentResult);
  }

  // ── ACTION: fix_inventory ─────────────────────────────────────────────────
  if (action === "fix_inventory" || action === "fix_one") {
    if (!cfg) {
      return Response.json({
        action, ok: false, summary: "Chưa cấu hình Shopify", timestamp,
      } satisfies AgentResult);
    }

    // Lọc sản phẩm cần fix
    const whereClause =
      action === "fix_one" && options.productId
        ? { id: String(options.productId), skuShopify: { not: null as null } }
        : { skuShopify: { not: null as null } };

    const [products, brosStocks, variantMap, locationId] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        select: { id: true, name: true, skuShopify: true, skuAmz: true, nhungQty: true },
      }),
      prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
      getVariantMap(cfg),
      getLocationId(cfg),
    ]);

    if (!locationId) {
      return Response.json({ action, ok: false, summary: "Không lấy được location ID từ Shopify", timestamp } satisfies AgentResult);
    }

    const brosMap: Record<string, number> = {};
    for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

    let fixed = 0;
    const fixedList: { sku: string; total: number }[] = [];

    for (const p of products) {
      if (!p.skuShopify) continue;
      const brosQty = (p.skuAmz ? brosMap[p.skuAmz] : null) ?? brosMap[p.skuShopify] ?? 0;
      const total = Math.max(0, Math.round(p.nhungQty + brosQty));
      const result = await pushTotalInventory(cfg, variantMap, locationId, p.skuShopify, total);
      if (result.ok) {
        fixed++;
        fixedList.push({ sku: p.skuShopify, total });
      } else {
        errors.push(result.error ?? p.skuShopify);
      }
    }

    triggerSheetSync("nhung");

    return Response.json({
      action,
      ok: errors.length === 0,
      summary: `✅ Đã push inventory cho ${fixed}/${products.length} sản phẩm lên Shopify`,
      details: { fixed, total: products.length, fixedList },
      errors: errors.length > 0 ? errors : undefined,
      timestamp,
    } satisfies AgentResult);
  }

  // ── ACTION: push_all_sheets ───────────────────────────────────────────────
  if (action === "push_all_sheets") {
    const targets = [
      "summary", "purchases", "products", "inventory",
      "sales", "inbound", "fbm", "production", "nhung", "nhung_orders",
    ];
    for (const t of targets) triggerSheetSync(t);
    return Response.json({
      action,
      ok: true,
      summary: `✅ Đã kích hoạt sync ${targets.length} sheet tabs`,
      details: { targets },
      timestamp,
    } satisfies AgentResult);
  }

  // ── ACTION: init_nhung ────────────────────────────────────────────────────
  if (action === "init_nhung") {
    if (!cfg) {
      return Response.json({ action, ok: false, summary: "Chưa cấu hình Shopify", timestamp } satisfies AgentResult);
    }

    const variantMap = await getVariantMap(cfg);
    const products = await prisma.product.findMany({
      where: { skuShopify: { not: null } },
    });

    let count = 0;
    const alreadySet: string[] = [];

    for (const p of products) {
      if (!p.skuShopify) continue;
      const variant = variantMap[p.skuShopify];
      if (!variant) continue;

      // Chỉ init nếu nhungQty = 0 (chưa được set)
      if (p.nhungQty !== 0 && !options.force) {
        alreadySet.push(p.skuShopify);
        continue;
      }

      await prisma.product.update({
        where: { id: p.id },
        data: { nhungQty: Math.max(0, variant.inventoryQty) },
      });
      count++;
    }

    triggerSheetSync("nhung");

    return Response.json({
      action,
      ok: true,
      summary: `✅ Đã khởi tạo nhungQty từ Shopify cho ${count} sản phẩm${alreadySet.length > 0 ? ` (bỏ qua ${alreadySet.length} sản phẩm đã có dữ liệu)` : ""}`,
      details: {
        initialized: count,
        skipped: alreadySet.length,
        tip: "Dùng options.force = true để ghi đè tất cả",
      },
      timestamp,
    } satisfies AgentResult);
  }

  return Response.json(
    { action, ok: false, summary: `Action không hợp lệ: ${action}`, timestamp },
    { status: 400 }
  );
}

// ─── GET /api/agent/sync ──────────────────────────────────────────────────────
// Quick status check không cần body

export async function GET() {
  const cfg = await getShopifyConfig();
  const shopifyConnected = !!cfg;

  const [productCount, pendingFulfillments, nhungZero] = await Promise.all([
    prisma.product.count({ where: { skuShopify: { not: null } } }),
    prisma.fulfillmentOrder.count({ where: { status: { in: ["pending", "notified"] } } }),
    prisma.product.count({ where: { nhungQty: 0, skuShopify: { not: null } } }),
  ]);

  const warnings: string[] = [];
  if (!shopifyConnected) warnings.push("Chưa kết nối Shopify");
  if (nhungZero > 0) warnings.push(`${nhungZero} sản phẩm có nhungQty = 0 (chưa khởi tạo)`);

  return Response.json({
    shopifyConnected,
    productCount,
    pendingFulfillments,
    nhungZero,
    warnings,
    availableActions: [
      { action: "check", description: "Kiểm tra toàn bộ sai lệch inventory" },
      { action: "fix_inventory", description: "Đẩy nhungQty + brosQty lên Shopify cho tất cả sản phẩm" },
      { action: "fix_one", description: "Fix inventory 1 sản phẩm", options: "{ productId }" },
      { action: "push_all_sheets", description: "Sync toàn bộ Google Sheets" },
      { action: "init_nhung", description: "Khởi tạo nhungQty = Shopify qty (lần đầu)", options: "{ force?: boolean }" },
    ],
  });
}
