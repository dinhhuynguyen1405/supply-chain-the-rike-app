import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { generateOrderCode } from "@/lib/utils";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function GET() {
  const orders = await prisma.purchaseOrder.findMany({
    orderBy: { orderDate: "desc" },
    include: {
      supplier: true,
      items: { include: { product: true } },
      payments: true,
    },
  });
  return Response.json(orders);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const totalVnd = (body.items as { subtotalVnd: number }[]).reduce(
    (sum, item) => sum + item.subtotalVnd,
    0
  );

  const isBuyOnBehalf = body.isBuyOnBehalf ?? false;
  // arrivedNow: hàng đã về ngay khi tạo đơn → status=arrived, không cần chờ
  const arrivedNow = body.arrivedNow ?? false;

  const order = await prisma.purchaseOrder.create({
    data: {
      code: generateOrderCode(),
      supplierId: body.supplierId,
      isBuyOnBehalf,
      orderDate: new Date(body.orderDate),
      expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
      arrivedDate: arrivedNow ? new Date(body.arrivedDate ?? body.orderDate) : null,
      status: arrivedNow ? "arrived" : "confirmed",
      shippingCode: body.shippingCode || null,
      shippingUnit: body.shippingUnit || null,
      notes: body.notes || null,
      totalVnd,
      shippingCostVnd: body.shippingCostVnd ? Number(body.shippingCostVnd) : null,
      purchaseType: body.purchaseType || "raw_material",
      purchaseDestination: body.purchaseDestination || "kho_huy",
      // arrivedNow + raw_material → packingStatus=pending (cần đóng gói)
      // arrivedNow + wholesale → packingStatus=done (đã đóng sẵn rồi)
      packingStatus: isBuyOnBehalf
        ? null
        : arrivedNow && (body.purchaseType === "wholesale")
          ? "done"
          : "pending",
      sellingPriceVnd: body.sellingPriceVnd ? Number(body.sellingPriceVnd) : null,
      items: {
        create: body.items.map(
          (item: { productId: string; quantity: number; priceVnd: number; subtotalVnd: number; notes?: string }) => ({
            productId: item.productId,
            quantity: item.quantity,
            priceVnd: item.priceVnd,
            subtotalVnd: item.subtotalVnd,
            notes: item.notes || null,
          })
        ),
      },
    },
    include: {
      supplier: true,
      items: { include: { product: true } },
    },
  });

  triggerSheetSync("purchases");
  return Response.json(order, { status: 201 });
}
