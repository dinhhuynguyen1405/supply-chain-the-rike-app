import { prisma } from "@/lib/prisma";
import { toSellingUnits } from "@/lib/utils";

export async function GET() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    totalOrders,
    activeOrders,
    purchaseAgg,
    salesAgg,
    recentOrders,
    ordersByStatus,
    allOrders,
    settingRows,
    // Pipeline counts
    pendingProductionCount,
    inProductionCount,
    activeShipmentsCount,
    inTransitCount,
    // Fulfillment: dùng status mới (pending/notified = đang xử lý)
    fulfillmentPendingCount,
    fulfillmentNotifiedCount,
    recentShipments,
    recentProduction,
    // Tồn kho: dùng nhungQty + brosQty
    allProducts,
    brosStocks,
    // Kho Nhung chưa khởi tạo
    nhungUninitCount,
    // Doanh thu 6 tháng (raw sales items for grouping)
    recentSalesItems,
    // Top products
    topProductsRaw,
    // Refunds + op costs for adjusted profit
    refundAgg,
    opCostAgg,
  ] = await Promise.all([
    prisma.purchaseOrder.count(),
    prisma.purchaseOrder.count({
      where: { status: { in: ["confirmed", "shipping", "arrived"] } },
    }),
    prisma.purchaseOrder.aggregate({ _sum: { totalVnd: true } }),
    prisma.salesItem.aggregate({ _sum: { subtotalUsd: true } }),
    prisma.purchaseOrder.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { supplier: true, items: { include: { product: true } } },
    }),
    prisma.purchaseOrder.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.purchaseOrder.findMany({
      where: { isBuyOnBehalf: true },
      include: { payments: true },
    }),
    prisma.setting.findMany(),
    // Pipeline
    prisma.productionOrder.count({ where: { status: "pending" } }),
    prisma.productionOrder.count({ where: { status: "in_production" } }),
    prisma.shipmentBatch.count({
      where: { status: { in: ["packing", "in_transit", "arrived_us", "received_by_td"] } },
    }),
    prisma.shipmentBatch.count({ where: { status: "in_transit" } }),
    // ✅ Status mới: pending = chờ xử lý
    prisma.fulfillmentOrder.count({ where: { status: "pending" } }),
    // ✅ Status mới: notified = đã báo kho, đang chờ ship
    prisma.fulfillmentOrder.count({ where: { status: "notified" } }),
    prisma.shipmentBatch.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      where: { status: { notIn: ["done"] } },
      select: {
        id: true, code: true, status: true,
        carrier: true, trackingCode: true, destinationWarehouse: true,
      },
    }),
    prisma.productionOrder.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      where: { status: { notIn: ["cancelled"] } },
      include: { purchaseOrder: { include: { supplier: true } } },
    }),
    // ✅ Tồn kho: dùng nhungQty + brosQty (nguồn chính xác)
    prisma.product.findMany({
      select: {
        id: true, name: true, nameVi: true,
        nhungQty: true, skuAmz: true, skuShopify: true,
        restockThreshold: true,
      },
    }),
    prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
    // Cảnh báo: sản phẩm có Shopify SKU nhưng nhungQty chưa được khởi tạo
    prisma.product.count({ where: { nhungQty: 0, skuShopify: { not: null } } }),
    // Doanh thu 6 tháng
    prisma.salesItem.findMany({
      where: { orderDate: { gte: sixMonthsAgo } },
      select: { orderDate: true, subtotalUsd: true },
    }),
    // Top products by revenue (last 90 ngày)
    prisma.salesItem.groupBy({
      by: ["productId"],
      where: { orderDate: { gte: ninetyDaysAgo }, productId: { not: null } },
      _sum: { subtotalUsd: true, quantity: true },
      orderBy: { _sum: { subtotalUsd: "desc" } },
      take: 5,
    }),
    // Refund tổng
    prisma.salesRefund.aggregate({ _sum: { amountUsd: true } }),
    // OpCost tổng
    prisma.operatingCost.aggregate({ _sum: { amountUsd: true, amountVnd: true } }),
  ]);

  // ── Settings ─────────────────────────────────────────────────────────────
  const settings: Record<string, string> = { usdToVnd: "25500" };
  for (const r of settingRows) settings[r.key] = r.value;
  const usdToVnd = Number(settings.usdToVnd);

  // ── Tài chính ─────────────────────────────────────────────────────────────
  const totalCostVnd = purchaseAgg._sum.totalVnd ?? 0;
  const totalRevenueUsd = salesAgg._sum.subtotalUsd ?? 0;
  const totalRevenueVnd = totalRevenueUsd * usdToVnd;
  const profitVnd = totalRevenueVnd - totalCostVnd;
  const profitMarginPct = totalRevenueVnd > 0 ? (profitVnd / totalRevenueVnd) * 100 : 0;

  // Adjusted profit: subtract refunds + operating costs
  const totalRefundsUsd = refundAgg._sum.amountUsd ?? 0;
  const totalOpCostsUsd = opCostAgg._sum.amountUsd ?? 0;
  const totalOpCostsVnd = opCostAgg._sum.amountVnd ?? 0;
  const adjustedProfitVnd = profitVnd
    - totalRefundsUsd * usdToVnd
    - totalOpCostsUsd * usdToVnd
    - totalOpCostsVnd;

  // ── Monthly revenue (last 6 months) ─────────────────────────────────────
  const monthMap: Record<string, { revenueUsd: number; orders: number }> = {};
  for (const item of recentSalesItems) {
    if (!item.orderDate) continue;
    const d = new Date(item.orderDate);
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    if (!monthMap[key]) monthMap[key] = { revenueUsd: 0, orders: 0 };
    monthMap[key].revenueUsd += item.subtotalUsd;
    monthMap[key].orders += 1;
  }
  // Build last 6 months in order
  const monthlyRevenue: { month: string; revenueUsd: number; orders: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const label = `T${d.getMonth() + 1}/${d.getFullYear()}`;
    monthlyRevenue.push({ month: label, ...(monthMap[key] ?? { revenueUsd: 0, orders: 0 }) });
  }

  // ── Top products ─────────────────────────────────────────────────────────
  const topProductIds = topProductsRaw.map((r) => r.productId as string).filter(Boolean);
  const topProductDetails = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true, nameVi: true },
  });
  const prodDetailMap = new Map(topProductDetails.map((p) => [p.id, p]));
  const topProducts = topProductsRaw.map((r) => {
    const prod = prodDetailMap.get(r.productId as string);
    return {
      productId: r.productId,
      name: prod?.name ?? "Unknown",
      nameVi: prod?.nameVi ?? null,
      totalSold: r._sum.quantity ?? 0,
      totalRevenueUsd: r._sum.subtotalUsd ?? 0,
    };
  });

  // ── Nợ khách hàng (mua hộ) ────────────────────────────────────────────────
  const customerDebts: { orderCode: string; owedVnd: number }[] = [];
  for (const order of allOrders) {
    if (!order.sellingPriceVnd) continue;
    const received = order.payments
      .filter((p) => p.direction === "from_customer")
      .reduce((s, p) => s + p.amount, 0);
    const owed = order.sellingPriceVnd - received;
    if (owed > 0) customerDebts.push({ orderCode: order.code, owedVnd: owed });
  }

  // ── Nợ nhà cung cấp ───────────────────────────────────────────────────────
  let supplierDebtVnd = 0;
  const allPurchaseOrders = await prisma.purchaseOrder.findMany({
    include: { payments: true },
    where: { status: { notIn: ["cancelled"] } },
  });
  for (const o of allPurchaseOrders) {
    const paid = o.payments
      .filter((p) => p.direction === "to_supplier")
      .reduce((s, p) => s + p.amount, 0);
    supplierDebtVnd += Math.max(0, o.totalVnd - paid);
  }

  // ── Low stock: dùng nhungQty + brosQty ───────────────────────────────────
  const brosMap: Record<string, number> = {};
  for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

  const lowStockProducts: {
    id: string; name: string; nameVi: string | null;
    stockUnits: number; threshold: number; nhungQty: number; brosQty: number;
  }[] = [];

  for (const p of allProducts) {
    // Chỉ cảnh báo low stock cho sản phẩm đã có trên Shopify (skuShopify != null)
    if (!p.skuShopify) continue;
    const brosQty =
      (p.skuAmz ? brosMap[p.skuAmz] : null) ??
      (p.skuShopify ? brosMap[p.skuShopify] : null) ??
      0;
    const stock = p.nhungQty + brosQty;
    const threshold = p.restockThreshold ?? 10;
    // Chỉ cảnh báo khi đã có nhungQty > 0 từ trước (tránh false alarm khi chưa khởi tạo)
    if (p.nhungQty > 0 && stock <= threshold) {
      lowStockProducts.push({
        id: p.id, name: p.name, nameVi: p.nameVi,
        stockUnits: stock, threshold,
        nhungQty: p.nhungQty, brosQty,
      });
    }
  }

  // ── Critical stock (hết hàng + có doanh thu gần đây) ────────────────────
  const recentSaleProductIds = new Set(
    (await prisma.salesItem.findMany({
      where: { orderDate: { gte: ninetyDaysAgo }, productId: { not: null } },
      select: { productId: true },
      distinct: ["productId"],
    })).map((s) => s.productId as string)
  );
  const criticalStockProducts = allProducts.filter((p) => {
    if (!p.skuShopify) return false;
    if (!recentSaleProductIds.has(p.id)) return false;
    const brosQty =
      (p.skuAmz ? brosMap[p.skuAmz] : null) ??
      (p.skuShopify ? brosMap[p.skuShopify] : null) ??
      0;
    return p.nhungQty === 0 && brosQty === 0;
  });

  const purchaseActiveCount = ordersByStatus
    .filter((s) => ["confirmed", "in_transit", "arrived"].includes(s.status))
    .reduce((sum, s) => sum + s._count.id, 0);

  // Cảnh báo hệ thống
  const systemWarnings: string[] = [];
  if (nhungUninitCount > 0) {
    systemWarnings.push(`${nhungUninitCount} sản phẩm chưa khởi tạo nhungQty — chạy Agent → "init_nhung"`);
  }

  return Response.json({
    totalOrders,
    activeOrders,
    totalPurchaseVnd: totalCostVnd,
    totalSalesUsd: totalRevenueUsd,
    recentOrders,
    ordersByStatus,
    usdToVnd,
    totalRevenueVnd,
    profitVnd,
    profitMarginPct,
    adjustedProfitVnd,
    totalRefundsUsd,
    totalOpCostsVnd: totalOpCostsUsd * usdToVnd + totalOpCostsVnd,
    customerDebts,
    totalCustomerDebtVnd: customerDebts.reduce((s, d) => s + d.owedVnd, 0),
    supplierDebtVnd,
    lowStockProducts,
    criticalStockProducts: criticalStockProducts.map((p) => ({
      id: p.id, name: p.name, nameVi: p.nameVi,
    })),
    systemWarnings,
    monthlyRevenue,
    topProducts,
    pipeline: {
      purchaseActive: purchaseActiveCount,
      productionPending: pendingProductionCount,
      productionActive: inProductionCount,
      shipmentsActive: activeShipmentsCount,
      shipmentsInTransit: inTransitCount,
      fulfillmentPending: fulfillmentPendingCount,
      fulfillmentNotified: fulfillmentNotifiedCount,
      fulfillmentActive: fulfillmentPendingCount + fulfillmentNotifiedCount,
    },
    recentShipments,
    recentProduction,
  });
}
