import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { generateOrderCode, generateProductionCode, calcPlannedQty } from "@/lib/utils";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function GET() {
  try {
    const orders = await prisma.purchaseOrder.findMany({
      orderBy: { orderDate: "desc" },
      include: {
        supplier: true,
        items: { include: { product: true } },
        payments: true,
        productionOrder: {
          select: {
            id: true,
            code: true,
            status: true,
            items: {
              select: {
                plannedQty: true,
                actualQty: true,
                product: { select: { nameVi: true, name: true } },
              },
            },
          },
        },
      },
    });
    return Response.json(orders);
  } catch (err) {
    console.error("[GET /api/purchases] Error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
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
          (item: { productId: string; groupId?: string; quantity: number; unit?: string; priceVnd: number; subtotalVnd: number; notes?: string }) => ({
            productId: item.productId || null,
            groupId: item.groupId || null,
            quantity: item.quantity,
            unit: item.unit || null,
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

  // Nếu arrivedNow + raw_material → auto tạo ProductionOrder ngay (giống PATCH arrived)
  if (arrivedNow && !isBuyOnBehalf && (body.purchaseType || "raw_material") === "raw_material") {
    try {
      await prisma.productionOrder.create({
        data: {
          code: generateProductionCode(),
          purchaseOrderId: order.id,
          status: "pending",
          items: {
            create: order.items
              .filter((pi) => pi.productId != null)
              .map((pi) => ({
                purchaseItemId: pi.id,
                productId: pi.productId!,
                gramsPerPack:  pi.product?.gramsPerUnit ?? null,
                piecesPerUnit: pi.product?.piecesPerUnit ?? null,
                piecesPerPack: pi.product?.piecesPerPack ?? null,
                plannedQty: pi.product ? calcPlannedQty(
                  pi.quantity,
                  pi.unit || pi.product.unit,
                  pi.product.gramsPerUnit,
                  pi.product.piecesPerUnit,
                  pi.product.piecesPerPack,
                ) : 0,
              })),
          },
        },
      });
    } catch { /* Nếu đã tồn tại → bỏ qua */ }
  }

  triggerSheetSync("purchases");
  return Response.json(order, { status: 201 });
}
