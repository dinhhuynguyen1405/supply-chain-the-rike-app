/**
 * GET /api/reconciliation
 * So khớp tồn kho: Shopify (live) vs Bros (DB cache) vs App calculated
 *
 * Query params:
 *   ?skipShopify=1   — bỏ qua gọi Shopify API (dùng cache, nhanh hơn)
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export interface ReconciliationItem {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  skuAmz: string | null;
  skuBros: string | null;
  unit: string;
  category: string | null;
  imageUrl: string | null;

  // ── Quantities ───────────────────────────────────────────────────────────────
  shopifyQty: number | null;   // Shopify báo cáo (live)
  brosQty: number | null;      // Bros kho thực tế (DB cache từ Bros sheet)
  inTransitQty: number;        // Đã mua, đang trên đường về VN→US
  arrivedQty: number;          // Đã về kho (arrived/completed status)
  soldQty: number;             // Đã bán qua Shopify
  actualStock: number;         // = brosQty ?? (arrivedQty - soldQty)
  shopifyDiff: number | null;  // shopifyQty - actualStock (>0: Shopify thừa, <0: thiếu)

  // ── Status & phương án ───────────────────────────────────────────────────────
  status: "ok" | "warning" | "critical" | "no_data";
  recommendation: string;

  // ── Bros sync metadata ───────────────────────────────────────────────────────
  brosSyncedAt: string | null;
}

export interface ReconciliationSummary {
  total: number;
  ok: number;
  warning: number;
  critical: number;
  no_data: number;
  hasShopifyData: boolean;
  oldestBrosSyncedAt: string | null;
  newestBrosSyncedAt: string | null;
}

export interface ReconciliationResponse {
  items: ReconciliationItem[];
  summary: ReconciliationSummary;
  shopifyFetched: boolean;
  generatedAt: string;
}

/** Đổi đơn vị mua (kg) → đơn vị bán (gói) */
function toSellingUnits(qty: number, unit: string, gramsPerUnit: number | null): number {
  if (gramsPerUnit && unit === "kg") return Math.floor((qty * 1000) / gramsPerUnit);
  return qty;
}

const IN_TRANSIT_STATUSES = ["confirmed", "in_transit", "packing"];
const ARRIVED_STATUSES = ["arrived", "completed"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const skipShopify = searchParams.get("skipShopify") === "1";

  // ── 1. App data from DB ────────────────────────────────────────────────────
  const [products, brosStocks, settings] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ nameVi: "asc" }, { name: "asc" }],
      include: {
        purchaseItems: {
          include: { purchaseOrder: { select: { status: true } } },
        },
        salesItems: { select: { quantity: true } },
      },
    }),
    prisma.warehouseStock.findMany({
      where: { warehouse: "bros" },
      select: { sku: true, inStock: true, lastSyncedAt: true },
    }),
    prisma.setting.findMany(),
  ]);

  // ── 2. Bros map: sku → { qty, syncedAt } ──────────────────────────────────
  const brosMap: Record<string, { qty: number; syncedAt: string | null }> = {};
  for (const s of brosStocks) {
    brosMap[s.sku] = {
      qty: (brosMap[s.sku]?.qty ?? 0) + s.inStock,
      syncedAt: s.lastSyncedAt?.toISOString() ?? null,
    };
  }

  // ── 3. Shopify live inventory map: sku → qty ──────────────────────────────
  const shopifyMap: Record<string, number> = {};
  let shopifyFetched = false;

  if (!skipShopify) {
    try {
      const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
      const domainRaw = config.shopifyStoreDomain || process.env.SHOPIFY_STORE_DOMAIN || "";
      const domain = domainRaw.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const token = config.shopifyAccessToken || config.shopifyApiSecret || process.env.SHOPIFY_API_SECRET || "";

      if (domain && token) {
        let pageUrl: string | null = `https://${domain}/admin/api/2024-01/products.json?limit=250&fields=variants`;
        while (pageUrl) {
          const shopRes: Response = await fetch(pageUrl, { headers: { "X-Shopify-Access-Token": token } });
          if (!shopRes.ok) break;
          const shopData = await shopRes.json();
          for (const p of shopData.products ?? []) {
            for (const v of p.variants ?? []) {
              if (v.sku) shopifyMap[v.sku] = (shopifyMap[v.sku] ?? 0) + (v.inventory_quantity ?? 0);
            }
          }
          const linkHeader: string = shopRes.headers.get("Link") ?? "";
          const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          pageUrl = nextMatch ? nextMatch[1] : null;
        }
        shopifyFetched = true;
      }
    } catch { /* Shopify optional */ }
  }

  // ── 4. Build reconciliation items ─────────────────────────────────────────
  const items: ReconciliationItem[] = products.map((p) => {
    // Quantities from App DB
    const inTransitQty = p.purchaseItems
      .filter((pi) => IN_TRANSIT_STATUSES.includes(pi.purchaseOrder.status))
      .reduce((sum, pi) => sum + toSellingUnits(pi.quantity, p.unit, p.gramsPerUnit), 0);

    const arrivedQty = p.purchaseItems
      .filter((pi) => ARRIVED_STATUSES.includes(pi.purchaseOrder.status))
      .reduce((sum, pi) => sum + toSellingUnits(pi.quantity, p.unit, p.gramsPerUnit), 0);

    const soldQty = p.salesItems.reduce((sum, si) => sum + si.quantity, 0);

    // Bros qty — Priority: skuBros > skuAmz > skuShopify
    const brosBySku =
      (p.skuBros     ? brosMap[p.skuBros]     : null) ??
      (p.skuAmz      ? brosMap[p.skuAmz]      : null) ??
      (p.skuShopify  ? brosMap[p.skuShopify]  : null) ??
      null;

    const brosQty      = brosBySku?.qty        ?? null;
    const brosSyncedAt = brosBySku?.syncedAt   ?? null;

    // Shopify qty
    const shopifyQty = shopifyFetched && p.skuShopify ? (shopifyMap[p.skuShopify] ?? null) : null;

    // Actual stock = Bros (source of truth) ?? App calculated
    const actualStock = brosQty !== null ? brosQty : Math.max(0, arrivedQty - soldQty);

    const shopifyDiff = shopifyQty !== null ? shopifyQty - actualStock : null;

    // ── Phương án ─────────────────────────────────────────────────────────────
    let recommendation = "";
    let status: ReconciliationItem["status"] = "no_data";

    if (shopifyDiff === null && brosQty === null) {
      status = "no_data";
      recommendation = "Chưa có dữ liệu Bros — sync Bros để xem so khớp";
    } else if (shopifyDiff === null) {
      status = "no_data";
      recommendation = brosQty === 0
        ? "Bros: hết hàng"
        : `Bros: còn ${brosQty} gói — chưa có SKU Shopify để so sánh`;
    } else if (shopifyDiff === 0) {
      status = "ok";
      recommendation = "✓ Khớp hoàn toàn";
    } else {
      const absDiff = Math.abs(shopifyDiff);
      status = absDiff <= 5 ? "warning" : "critical";

      if (shopifyDiff > 0) {
        recommendation = `Shopify đang thừa ${shopifyDiff} gói so với thực tế tại Bros`;
        if (inTransitQty > 0) {
          recommendation += ` (có ${inTransitQty} gói đang trên đường về — chưa nhận)`;
        }
      } else {
        recommendation = `Shopify đang thiếu ${absDiff} gói — Bros có nhưng Shopify chưa cập nhật`;
        if (brosQty === 0) {
          recommendation = `Bros hết hàng (0 gói) nhưng Shopify vẫn hiển thị ${shopifyQty} — cần tắt listing hoặc restock`;
        }
      }
    }

    // Thêm gợi ý về hàng đang về
    if (inTransitQty > 0 && status !== "ok") {
      recommendation += `. Lưu ý: ${inTransitQty} gói đang trên đường về`;
    }

    return {
      id: p.id,
      name: p.name,
      nameVi: p.nameVi,
      skuShopify: p.skuShopify,
      skuAmz: p.skuAmz,
      skuBros: p.skuBros,
      unit: p.unit,
      category: p.category,
      imageUrl: p.imageUrl,
      shopifyQty,
      brosQty,
      inTransitQty,
      arrivedQty,
      soldQty,
      actualStock,
      shopifyDiff,
      status,
      recommendation,
      brosSyncedAt,
    };
  });

  // ── 5. Summary ────────────────────────────────────────────────────────────
  const syncDates = brosStocks.map((s) => s.lastSyncedAt).filter(Boolean) as Date[];
  const summary: ReconciliationSummary = {
    total: items.length,
    ok:       items.filter((i) => i.status === "ok").length,
    warning:  items.filter((i) => i.status === "warning").length,
    critical: items.filter((i) => i.status === "critical").length,
    no_data:  items.filter((i) => i.status === "no_data").length,
    hasShopifyData: shopifyFetched,
    oldestBrosSyncedAt: syncDates.length ? new Date(Math.min(...syncDates.map((d) => d.getTime()))).toISOString() : null,
    newestBrosSyncedAt: syncDates.length ? new Date(Math.max(...syncDates.map((d) => d.getTime()))).toISOString() : null,
  };

  return Response.json({
    items,
    summary,
    shopifyFetched,
    generatedAt: new Date().toISOString(),
  } satisfies ReconciliationResponse);
}
