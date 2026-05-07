/**
 * GET /api/analytics/restock
 * ─────────────────────────────────────────────────────────────────────────────
 * Phân tích tồn kho + tốc độ bán để đề xuất sản phẩm cần nhập thêm.
 *
 * Nguồn dữ liệu:
 *  - ShopifyOrder.lineItemsJson  → tốc độ bán thực tế (toàn bộ lịch sử)
 *  - Product.nhungQty / brosQty  → tồn kho hiện tại
 *
 * Trả về:
 *  - summary: tổng quan shop (orders, revenue, period)
 *  - items: từng sản phẩm có bán với velocity + days_left + urgency
 *  - noStockItems: sản phẩm đang có listing nhưng chưa từng bán
 */

import { prisma } from "@/lib/prisma";

interface LineItem {
  sku?: string;
  title?: string;
  quantity?: number;
  price?: string;
}

export interface RestockItem {
  // Nhận dạng
  sku: string;
  title: string;
  productId: string | null;
  localName: string | null;
  // Bán hàng
  totalSold: number;
  numOrders: number;
  revenueUsd: number;
  firstSale: string;
  lastSale: string;
  daysTracked: number;
  soldPerMonth: number;    // velocity: gói/tháng
  soldPerDay: number;
  // Tồn kho
  nhungQty: number;
  brosQty: number;
  totalStock: number;
  // Dự báo
  daysLeft: number | null; // null nếu không bán → không tính được
  monthsLeft: number | null;
  // Phân loại
  urgency: "critical" | "warning" | "healthy" | "overstocked" | "no_sales";
  priceUsd: number | null;
}

export interface RestockSummary {
  totalOrders: number;
  totalRevenueUsd: number;
  periodDays: number;
  ordersPerDay: number;
  revenuePerDay: number;
  oldestOrder: string;
  newestOrder: string;
}

export interface RestockResponse {
  summary: RestockSummary;
  items: RestockItem[];
  generatedAt: string;
}

export async function GET() {
  // 1. Load tất cả Shopify orders
  const orders = await prisma.shopifyOrder.findMany({
    select: { lineItemsJson: true, createdAtShopify: true },
    orderBy: { createdAtShopify: "asc" },
  });

  // 2. Load products (skuShopify → id, name, nhungQty, priceUsd)
  const products = await prisma.product.findMany({
    select: { id: true, name: true, nameVi: true, skuShopify: true, nhungQty: true, priceUsd: true },
  });
  const productBySku: Record<string, typeof products[0]> = {};
  for (const p of products) {
    if (p.skuShopify) productBySku[p.skuShopify] = p;
  }

  // 3. Load Bros stock
  const brosStocks = await prisma.warehouseStock.findMany({
    where: { warehouse: "bros", inStock: { gt: 0 } },
    select: { sku: true, inStock: true },
  });
  const brosMap: Record<string, number> = {};
  for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

  // Bros qty for a product
  function getBrosQty(p: typeof products[0]): number {
    return brosMap[p.skuShopify ?? ""] ?? 0;
  }

  // 4. Aggregate sales by SKU
  interface SkuAgg {
    title: string;
    totalSold: number;
    numOrders: number;
    revenueUsd: number;
    firstSale: Date;
    lastSale: Date;
  }
  const skuAgg: Record<string, SkuAgg> = {};

  let shopifyTotalRevenue = 0;
  for (const o of orders) {
    try {
      const items: LineItem[] = JSON.parse(o.lineItemsJson);
      const orderDate = new Date(o.createdAtShopify);
      for (const item of items) {
        const sku = item.sku?.trim();
        if (!sku) continue;
        const qty = Number(item.quantity ?? 0);
        const price = parseFloat(item.price ?? "0");
        shopifyTotalRevenue += qty * price;
        if (!skuAgg[sku]) {
          skuAgg[sku] = {
            title: item.title ?? sku,
            totalSold: 0,
            numOrders: 0,
            revenueUsd: 0,
            firstSale: orderDate,
            lastSale: orderDate,
          };
        }
        skuAgg[sku].totalSold += qty;
        skuAgg[sku].numOrders += 1;
        skuAgg[sku].revenueUsd += qty * price;
        if (orderDate < skuAgg[sku].firstSale) skuAgg[sku].firstSale = orderDate;
        if (orderDate > skuAgg[sku].lastSale) skuAgg[sku].lastSale = orderDate;
      }
    } catch { /* malformed JSON */ }
  }

  // 5. Summary
  const now = new Date();
  const oldest = orders[0]?.createdAtShopify ?? now;
  const newest = orders[orders.length - 1]?.createdAtShopify ?? now;
  const periodDays = Math.max(1, Math.round((now.getTime() - new Date(oldest).getTime()) / 86400000));

  const summary: RestockSummary = {
    totalOrders: orders.length,
    totalRevenueUsd: Math.round(shopifyTotalRevenue * 100) / 100,
    periodDays,
    ordersPerDay: Math.round((orders.length / periodDays) * 10) / 10,
    revenuePerDay: Math.round((shopifyTotalRevenue / periodDays) * 100) / 100,
    oldestOrder: new Date(oldest).toISOString(),
    newestOrder: new Date(newest).toISOString(),
  };

  // 6. Build RestockItem list
  const items: RestockItem[] = [];

  for (const [sku, agg] of Object.entries(skuAgg)) {
    const product = productBySku[sku] ?? null;
    const nhungQty = product?.nhungQty ?? 0;
    const brosQty = product ? getBrosQty(product) : (brosMap[sku] ?? 0);
    const totalStock = nhungQty + brosQty;

    const daysTracked = Math.max(1, Math.round(
      (now.getTime() - agg.firstSale.getTime()) / 86400000
    ));
    const soldPerDay = agg.totalSold / daysTracked;
    const soldPerMonth = soldPerDay * 30;

    const daysLeft = soldPerDay > 0 ? Math.round(totalStock / soldPerDay) : null;
    const monthsLeft = daysLeft != null ? Math.round(daysLeft / 30 * 10) / 10 : null;

    // Urgency classification
    let urgency: RestockItem["urgency"];
    if (soldPerDay === 0) {
      urgency = "no_sales";
    } else if (daysLeft === null || daysLeft <= 30) {
      urgency = totalStock === 0 ? "critical" : "critical";
    } else if (daysLeft <= 90) {
      urgency = "warning";
    } else if (monthsLeft !== null && monthsLeft > 12) {
      urgency = "overstocked";
    } else {
      urgency = "healthy";
    }

    // Refine critical vs out-of-stock
    if (totalStock === 0 && soldPerDay > 0) urgency = "critical";
    else if (daysLeft !== null && daysLeft <= 14) urgency = "critical";
    else if (daysLeft !== null && daysLeft > 365) urgency = "overstocked";

    items.push({
      sku,
      title: agg.title,
      productId: product?.id ?? null,
      localName: product?.nameVi ?? product?.name ?? null,
      totalSold: Math.round(agg.totalSold),
      numOrders: agg.numOrders,
      revenueUsd: Math.round(agg.revenueUsd * 100) / 100,
      firstSale: agg.firstSale.toISOString(),
      lastSale: agg.lastSale.toISOString(),
      daysTracked,
      soldPerMonth: Math.round(soldPerMonth * 10) / 10,
      soldPerDay: Math.round(soldPerDay * 100) / 100,
      nhungQty,
      brosQty,
      totalStock,
      daysLeft,
      monthsLeft,
      urgency,
      priceUsd: product?.priceUsd ?? null,
    });
  }

  // Sort: critical first, then by soldPerMonth desc
  const urgencyOrder: Record<RestockItem["urgency"], number> = {
    critical: 0, warning: 1, healthy: 2, overstocked: 3, no_sales: 4,
  };
  items.sort((a, b) => {
    const uo = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (uo !== 0) return uo;
    return b.soldPerMonth - a.soldPerMonth;
  });

  return Response.json({ summary, items, generatedAt: now.toISOString() } satisfies RestockResponse);
}
