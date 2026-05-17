import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";
import { generateProductionCode, calcPlannedQty } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
          group: { select: { id: true, name: true, costUnit: true } },
        },
      },
      payments: { orderBy: { paidAt: "asc" } },
      productionOrder: {
        include: {
          items: {
            include: { product: { select: { id: true, nameVi: true, name: true } } },
          },
        },
      },
    },
  });
  if (!order) return new Response("Not found", { status: 404 });
  return Response.json(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Chỉ update field nào được gửi lên (partial update)
  const updateData: Record<string, unknown> = {};
  if ("status" in body) updateData.status = body.status;
  if ("isBuyOnBehalf" in body) updateData.isBuyOnBehalf = body.isBuyOnBehalf;
  if ("shippingCode" in body) updateData.shippingCode = body.shippingCode;
  if ("shippingUnit" in body) updateData.shippingUnit = body.shippingUnit;
  if ("arrivedDate" in body) updateData.arrivedDate = body.arrivedDate ? new Date(body.arrivedDate) : null;
  if ("sellingPriceVnd" in body) updateData.sellingPriceVnd = body.sellingPriceVnd ? Number(body.sellingPriceVnd) : null;
  if ("notes" in body) updateData.notes = body.notes;
  if ("shippingCostVnd" in body) updateData.shippingCostVnd = body.shippingCostVnd ? Number(body.shippingCostVnd) : null;
  if ("packingLaborVnd" in body) updateData.packingLaborVnd = body.packingLaborVnd ? Number(body.packingLaborVnd) : null;
  if ("packingStatus" in body) updateData.packingStatus = body.packingStatus;
  if ("purchaseType" in body) updateData.purchaseType = body.purchaseType;
  if ("purchaseDestination" in body) updateData.purchaseDestination = body.purchaseDestination;

  const order = await prisma.purchaseOrder.update({
    where: { id },
    data: updateData,
    include: {
      supplier: true,
      items: {
        include: {
          product: true,
          group: { select: { id: true, name: true, costUnit: true } },
        },
      },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });

  triggerSheetSync("purchases");

  // Khi đơn mua đạt tiêu chuẩn: báo hàng đã về (arrived), loại raw_material (nguyên liệu), không mua hộ
  const newStatus = body.status ?? order.status;
  const newPurchaseType = body.purchaseType ?? order.purchaseType;
  const newIsBuyOnBehalf = body.isBuyOnBehalf ?? order.isBuyOnBehalf;

  const needsProduction =
    newStatus === "arrived" &&
    !newIsBuyOnBehalf &&
    newPurchaseType === "raw_material";

  if (needsProduction) {
    const existing = await prisma.productionOrder.findUnique({
      where: { purchaseOrderId: id },
    });
    if (!existing) {
      const purchaseItems = await prisma.purchaseItem.findMany({
        where: { purchaseOrderId: id },
        include: { product: true, group: true },
      });
      const itemsWithProduct = purchaseItems.filter((pi) => pi.productId != null);
      if (purchaseItems.length > 0) {
        await prisma.productionOrder.create({
          data: {
            code: generateProductionCode(),
            purchaseOrderId: id,
            status: "pending",
            items: {
              create: itemsWithProduct.map((pi) => ({
                purchaseItemId: pi.id,
                productId: pi.productId!,
                gramsPerPack:  pi.product?.gramsPerUnit ?? null,
                piecesPerUnit: pi.product?.piecesPerUnit ?? null,
                piecesPerPack: pi.product?.piecesPerPack ?? null,
                plannedQty: pi.product ? calcPlannedQty(
                  pi.quantity,
                  // group-based items: dùng costUnit của group (kg) thay vì product.unit (có thể là "unit")
                  pi.group?.costUnit || pi.unit || pi.product.unit,
                  pi.product.gramsPerUnit,
                  pi.product.piecesPerUnit,
                  pi.product.piecesPerPack,
                ) : 0,
              })),
            },
          },
        });
      }
    }
  }

  return Response.json(order);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Phải xoá theo đúng thứ tự để tránh FK constraint errors
  // 1. Tìm ProductionOrder liên kết (nếu có)
  const productionOrder = await prisma.productionOrder.findUnique({
    where: { purchaseOrderId: id },
    select: { id: true },
  });

  if (productionOrder) {
    // 1a. Xoá ProductionCost + ProductionItem (cascade từ ProductionOrder)
    await prisma.productionOrder.delete({ where: { id: productionOrder.id } });
  }

  // 2. Xoá liên kết ShipmentBatchOrder (junction table)
  await prisma.shipmentBatchOrder.deleteMany({ where: { purchaseOrderId: id } });

  // 3. Set null FundTransaction.purchaseOrderId để không mất sổ quỹ
  await prisma.fundTransaction.updateMany({
    where: { purchaseOrderId: id },
    data: { purchaseOrderId: null },
  });

  // 4. Xoá PurchaseOrder (cascade xoá PurchaseItem + Payment)
  await prisma.purchaseOrder.delete({ where: { id } });

  triggerSheetSync("purchases");
  return new Response(null, { status: 204 });
}
