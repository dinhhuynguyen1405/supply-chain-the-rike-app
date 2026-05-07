/**
 * PATCH /api/purchases/[id]/items
 * Đổi sản phẩm liên kết (productId) của một purchase item.
 * Đồng thời cập nhật ProductionItem tương ứng (nếu có) với plannedQty mới.
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { calcPlannedQty } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: purchaseOrderId } = await params;
  const body = await req.json();
  const { itemId, productId } = body;

  if (!itemId || !productId) {
    return Response.json({ error: "Cần truyền itemId và productId" }, { status: 400 });
  }

  // Lấy thông tin sản phẩm mới
  const newProduct = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, unit: true, gramsPerUnit: true, piecesPerUnit: true, piecesPerPack: true },
  });
  if (!newProduct) return Response.json({ error: "Sản phẩm không tìm thấy" }, { status: 404 });

  // Lấy purchase item hiện tại
  const purchaseItem = await prisma.purchaseItem.findFirst({
    where: { id: itemId, purchaseOrderId },
    include: { productionItem: true },
  });
  if (!purchaseItem) return Response.json({ error: "Item không tìm thấy" }, { status: 404 });

  // Update productId của purchase item
  await prisma.purchaseItem.update({
    where: { id: itemId },
    data: { productId },
  });

  // Nếu có ProductionItem liên kết → cập nhật productId + tính lại plannedQty
  if (purchaseItem.productionItem) {
    const newPlanned = calcPlannedQty(
      purchaseItem.quantity,
      newProduct.unit,
      newProduct.gramsPerUnit,
      newProduct.piecesPerUnit,
      newProduct.piecesPerPack,
    );
    await prisma.productionItem.update({
      where: { id: purchaseItem.productionItem.id },
      data: {
        productId,
        gramsPerPack: newProduct.gramsPerUnit,
        piecesPerUnit: newProduct.piecesPerUnit,
        piecesPerPack: newProduct.piecesPerPack,
        plannedQty: newPlanned,
      },
    });
  }

  return Response.json({ ok: true });
}
