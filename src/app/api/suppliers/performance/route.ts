/**
 * GET /api/suppliers/performance
 * Performance metrics per supplier: orders, spend, top products, avg delivery days
 */
import { prisma } from "@/lib/prisma";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    include: {
      purchaseOrders: {
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, nameVi: true } },
            },
          },
        },
      },
    },
  });

  const results = suppliers.map((s) => {
    const orders = s.purchaseOrders;
    const totalOrders = orders.length;
    const totalSpendVnd = orders.reduce((sum, o) => sum + o.totalVnd, 0);
    const completedOrders = orders.filter((o) => o.arrivedDate && o.orderDate);

    // Avg delivery days for orders that have both dates
    let avgDeliveryDays: number | null = null;
    if (completedOrders.length > 0) {
      const totalDays = completedOrders.reduce((sum, o) => {
        const diff =
          new Date(o.arrivedDate!).getTime() -
          new Date(o.orderDate).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0);
      avgDeliveryDays = Math.round(totalDays / completedOrders.length);
    }

    // Top products by quantity
    const productQty: Record<string, { name: string; qty: number }> = {};
    for (const order of orders) {
      for (const item of order.items) {
        if (!item.productId || !item.product) continue;
        const key = item.productId;
        if (!productQty[key]) {
          productQty[key] = { name: item.product.nameVi ?? item.product.name, qty: 0 };
        }
        productQty[key].qty += item.quantity;
      }
    }
    const topProducts = Object.values(productQty)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    // On-time rate (arrived before or on expectedDate)
    const ordersWithExpected = orders.filter((o) => o.expectedDate && o.arrivedDate);
    const onTimeCount = ordersWithExpected.filter((o) => {
      return new Date(o.arrivedDate!) <= new Date(o.expectedDate!);
    }).length;
    const onTimeRate = ordersWithExpected.length > 0
      ? Math.round((onTimeCount / ordersWithExpected.length) * 100)
      : null;

    // Most recent order date
    const latestOrder = orders.sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    )[0];

    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      location: s.location,
      notes: s.notes,
      totalOrders,
      totalSpendVnd,
      avgDeliveryDays,
      onTimeRate,
      topProducts,
      lastOrderDate: latestOrder?.orderDate ?? null,
    };
  });

  // Sort by total spend desc
  results.sort((a, b) => b.totalSpendVnd - a.totalSpendVnd);

  return Response.json(results);
}
