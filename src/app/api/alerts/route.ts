import { prisma } from "@/lib/prisma";

/**
 * GET /api/alerts
 * Lightweight endpoint for sidebar badges.
 * Returns critical stock count + pending fulfillment count.
 */
export async function GET() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [recentSales, brosStocks, pendingFulfillment] = await Promise.all([
    prisma.salesItem.findMany({
      where: { orderDate: { gte: ninetyDaysAgo }, productId: { not: null } },
      select: { productId: true },
      distinct: ["productId"],
    }),
    prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
    prisma.fulfillmentOrder.count({
      where: { status: { in: ["pending", "notified"] } },
    }),
  ]);

  const activeProductIds = recentSales.map((s) => s.productId as string);

  const brosMap: Record<string, number> = {};
  brosStocks.forEach((s) => {
    brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;
  });

  const products = await prisma.product.findMany({
    where: { id: { in: activeProductIds }, skuShopify: { not: null } },
    select: { id: true, nhungQty: true, skuAmz: true, skuShopify: true },
  });

  const criticalRestock = products.filter((p) => {
    const brosQty =
      (p.skuAmz ? brosMap[p.skuAmz] : 0) ??
      (p.skuShopify ? brosMap[p.skuShopify!] : 0) ??
      0;
    return p.nhungQty === 0 && brosQty === 0;
  }).length;

  return Response.json({ criticalRestock, pendingFulfillment });
}
