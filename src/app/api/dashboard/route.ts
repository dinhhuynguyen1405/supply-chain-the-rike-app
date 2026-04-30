import { prisma } from "@/lib/prisma";

function toSellingUnits(quantity: number, unit: string, gramsPerUnit: number | null): number {
  if (gramsPerUnit && unit === "kg") return Math.floor((quantity * 1000) / gramsPerUnit);
  return quantity;
}

export async function GET() {
  const [
    totalOrders,
    activeOrders,
    purchaseAgg,
    salesAgg,
    recentOrders,
    ordersByStatus,
    _placeholder,
    allOrders,
    allProducts,
    settingRows,
    pendingProductionCount,
    inProductionCount,
    activeShipmentsCount,
    inTransitCount,
    pendingFulfillmentCount,
    recentShipments,
    recentProduction,
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
    Promise.resolve([]),
    prisma.purchaseOrder.findMany({
      where: { isBuyOnBehalf: true },
      include: { payments: true },
    }),
    prisma.product.findMany({
      include: {
        purchaseItems: { include: { purchaseOrder: { select: { status: true } } } },
        salesItems: { select: { quantity: true } },
      },
    }),
    prisma.setting.findMany(),
    // Pipeline
    prisma.productionOrder.count({ where: { status: "pending" } }),
    prisma.productionOrder.count({ where: { status: "in_production" } }),
    prisma.shipmentBatch.count({ where: { status: { in: ["packing", "in_transit", "arrived_us", "received_by_td"] } } }),
    prisma.shipmentBatch.count({ where: { status: "in_transit" } }),
    prisma.fulfillmentOrder.count({ where: { status: { in: ["pending", "sent_to_td", "packing"] } } }),
    prisma.shipmentBatch.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      where: { status: { notIn: ["done"] } },
    }),
    prisma.productionOrder.findMany({
      take: 3,
      orderBy: { createdAt: "desc" },
      where: { status: { notIn: ["cancelled"] } },
      include: { purchaseOrder: { include: { supplier: true } } },
    }),
  ]);

  const settings: Record<string, string> = { usdToVnd: "25500" };
  for (const r of settingRows) settings[r.key] = r.value;
  const usdToVnd = Number(settings.usdToVnd);

  const totalCostVnd = purchaseAgg._sum.totalVnd ?? 0;
  const totalRevenueUsd = salesAgg._sum.subtotalUsd ?? 0;
  const totalRevenueVnd = totalRevenueUsd * usdToVnd;
  const profitVnd = totalRevenueVnd - totalCostVnd;
  const profitMarginPct = totalRevenueVnd > 0 ? (profitVnd / totalRevenueVnd) * 100 : 0;

  const customerDebts: { orderCode: string; owedVnd: number }[] = [];
  for (const order of allOrders) {
    if (!order.sellingPriceVnd) continue;
    const received = order.payments
      .filter((p) => p.direction === "from_customer")
      .reduce((s, p) => s + p.amount, 0);
    const owed = order.sellingPriceVnd - received;
    if (owed > 0) customerDebts.push({ orderCode: order.code, owedVnd: owed });
  }

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

  const arrivedStatuses = ["arrived", "completed"];
  const lowStockProducts: { id: string; name: string; nameVi: string | null; stockUnits: number; threshold: number }[] = [];
  for (const p of allProducts) {
    const purchased = p.purchaseItems
      .filter((pi) => arrivedStatuses.includes(pi.purchaseOrder.status))
      .reduce((s, pi) => s + toSellingUnits(pi.quantity, p.unit, p.gramsPerUnit), 0);
    const sold = p.salesItems.reduce((s, si) => s + si.quantity, 0);
    const stock = purchased - sold;
    const threshold = p.restockThreshold ?? 10;
    if (purchased > 0 && stock <= threshold) {
      lowStockProducts.push({ id: p.id, name: p.name, nameVi: p.nameVi, stockUnits: stock, threshold });
    }
  }

  const purchaseActiveCount = ordersByStatus
    .filter((s) => ["confirmed", "in_transit", "arrived"].includes(s.status))
    .reduce((sum, s) => sum + s._count.id, 0);

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
    pipeline: {
      purchaseActive: purchaseActiveCount,
      productionPending: pendingProductionCount,
      productionActive: inProductionCount,
      shipmentsActive: activeShipmentsCount,
      shipmentsInTransit: inTransitCount,
      fulfillmentPending: pendingFulfillmentCount,
    },
    recentShipments,
    recentProduction,
  });
}
