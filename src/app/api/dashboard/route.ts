import { prisma } from "@/lib/prisma";
import { toSellingUnits } from "@/lib/utils";

export async function GET() {
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
    customerDebts,
    totalCustomerDebtVnd: customerDebts.reduce((s, d) => s + d.owedVnd, 0),
    supplierDebtVnd,
    lowStockProducts,
    systemWarnings,
    pipeline: {
      purchaseActive: purchaseActiveCount,
      productionPending: pendingProductionCount,
      productionActive: inProductionCount,
      shipmentsActive: activeShipmentsCount,
      shipmentsInTransit: inTransitCount,
      // ✅ Đúng status mới
      fulfillmentPending: fulfillmentPendingCount,
      fulfillmentNotified: fulfillmentNotifiedCount,
      fulfillmentActive: fulfillmentPendingCount + fulfillmentNotifiedCount,
    },
    recentShipments,
    recentProduction,
  });
}
