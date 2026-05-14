/**
 * GET /api/analytics/profit
 * Tính COGS, doanh thu, lợi nhuận, margin cho từng sản phẩm.
 *
 * Công thức:
 *   COGS = Σ (purchaseItem.priceVnd × purchaseItem.quantity) / totalBought × soldQty
 *   Revenue = Σ (salesItem.subtotalUsd) × usdToVnd
 *   Gross Profit = Revenue − COGS
 *   Margin % = Gross Profit / Revenue × 100
 */
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Tỷ giá
  const rateSetting = await prisma.setting.findUnique({ where: { key: "usdToVnd" } });
  const usdToVnd = parseFloat(rateSetting?.value ?? "25500") || 25500;

  // Tất cả purchase items (cost data)
  const purchaseItems = await prisma.purchaseItem.findMany({
    select: {
      productId: true,
      quantity: true,
      priceVnd: true,
      subtotalVnd: true,
    },
  });

  // Tất cả sales items (revenue data)
  const salesItems = await prisma.salesItem.findMany({
    select: {
      productId: true,
      quantity: true,
      priceUsd: true,
      subtotalUsd: true,
    },
  });

  // Tất cả sản phẩm
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      nameVi: true,
      skuShopify: true,
      skuAmz: true,
      category: true,
      unit: true,
      gramsPerUnit: true,
      imageUrl: true,
    },
  });

  // Tính toán per product
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Aggregate purchases
  const purchaseAgg = new Map<string, { totalQty: number; totalCostVnd: number }>();
  for (const item of purchaseItems) {
    if (!item.productId) continue;
    const cur = purchaseAgg.get(item.productId) ?? { totalQty: 0, totalCostVnd: 0 };
    cur.totalQty += item.quantity;
    cur.totalCostVnd += item.subtotalVnd;
    purchaseAgg.set(item.productId, cur);
  }

  // Aggregate sales
  const salesAgg = new Map<string, { totalQty: number; totalRevenueUsd: number }>();
  for (const item of salesItems) {
    if (!item.productId) continue;
    const cur = salesAgg.get(item.productId) ?? { totalQty: 0, totalRevenueUsd: 0 };
    cur.totalQty += item.quantity;
    cur.totalRevenueUsd += item.subtotalUsd;
    salesAgg.set(item.productId, cur);
  }

  // Build result
  const results = products
    .map((p) => {
      const pAgg = purchaseAgg.get(p.id);
      const sAgg = salesAgg.get(p.id);

      const totalBought = pAgg?.totalQty ?? 0;
      const totalCostVnd = pAgg?.totalCostVnd ?? 0;
      const avgCostPerUnitVnd = totalBought > 0 ? totalCostVnd / totalBought : 0;

      const totalSold = sAgg?.totalQty ?? 0;
      const totalRevenueUsd = sAgg?.totalRevenueUsd ?? 0;
      const totalRevenueVnd = totalRevenueUsd * usdToVnd;

      // COGS = avg cost × units sold
      const cogsVnd = avgCostPerUnitVnd * totalSold;
      const grossProfitVnd = totalRevenueVnd - cogsVnd;
      const marginPct = totalRevenueVnd > 0 ? (grossProfitVnd / totalRevenueVnd) * 100 : 0;
      const avgSellingPriceUsd = totalSold > 0 ? totalRevenueUsd / totalSold : 0;

      return {
        productId: p.id,
        name: p.name,
        nameVi: p.nameVi,
        skuShopify: p.skuShopify,
        skuAmz: p.skuAmz,
        category: p.category,
        unit: p.unit,
        imageUrl: p.imageUrl,
        // Cost
        totalBought,
        totalCostVnd,
        avgCostPerUnitVnd,
        // Sales
        totalSold,
        totalRevenueUsd,
        totalRevenueVnd,
        // P&L
        cogsVnd,
        grossProfitVnd,
        marginPct,
        avgSellingPriceUsd,
      };
    })
    .filter((r) => r.totalBought > 0 || r.totalSold > 0) // chỉ sản phẩm có data
    .sort((a, b) => b.grossProfitVnd - a.grossProfitVnd); // sắp xếp theo lợi nhuận cao → thấp

  const totals = results.reduce(
    (acc, r) => {
      acc.totalRevenueVnd += r.totalRevenueVnd;
      acc.totalCogsVnd += r.cogsVnd;
      acc.totalProfitVnd += r.grossProfitVnd;
      return acc;
    },
    { totalRevenueVnd: 0, totalCogsVnd: 0, totalProfitVnd: 0 }
  );

  return Response.json({ products: results, totals, usdToVnd });
}
