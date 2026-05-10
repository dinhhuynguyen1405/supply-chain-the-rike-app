/**
 * PATCH /api/purchases/[id]/items  — đổi productId hoặc sửa qty/price của purchase item
 * POST  /api/purchases/[id]/items  — thêm dòng hàng mới vào đơn
 * DELETE /api/purchases/[id]/items — xoá 1 dòng hàng khỏi đơn
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { calcPlannedQty } from "@/lib/utils";

// ── PATCH: đổi sản phẩm HOẶC sửa qty/price ──────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: purchaseOrderId } = await params;
  const body = await req.json();
  const { itemId, productId, quantity, priceVnd } = body;

  if (!itemId) {
    return Response.json({ error: "Cần truyền itemId" }, { status: 400 });
  }

  // Lấy purchase item hiện tại
  const purchaseItem = await prisma.purchaseItem.findFirst({
    where: { id: itemId, purchaseOrderId },
    include: { productionItem: true },
  });
  if (!purchaseItem) return Response.json({ error: "Item không tìm thấy" }, { status: 404 });

  // Tính dữ liệu update
  const updateData: Record<string, unknown> = {};
  const newQty = quantity !== undefined ? Number(quantity) : purchaseItem.quantity;
  const newPrice = priceVnd !== undefined ? Number(priceVnd) : purchaseItem.priceVnd;

  if (productId !== undefined) updateData.productId = productId;
  if (quantity !== undefined) updateData.quantity = newQty;
  if (priceVnd !== undefined) {
    updateData.priceVnd = newPrice;
    updateData.subtotalVnd = newQty * newPrice;
  } else if (quantity !== undefined) {
    updateData.subtotalVnd = newQty * newPrice;
  }

  // Update purchase item
  await prisma.purchaseItem.update({
    where: { id: itemId },
    data: updateData,
  });

  // Nếu có ProductionItem liên kết → cập nhật
  if (purchaseItem.productionItem) {
    const effectiveProductId = productId ?? purchaseItem.productId;
    const newProduct = await prisma.product.findUnique({
      where: { id: effectiveProductId },
      select: { unit: true, gramsPerUnit: true, piecesPerUnit: true, piecesPerPack: true },
    });
    if (newProduct) {
      const newPlanned = calcPlannedQty(
        newQty,
        newProduct.unit,
        newProduct.gramsPerUnit,
        newProduct.piecesPerUnit,
        newProduct.piecesPerPack,
      );
      await prisma.productionItem.update({
        where: { id: purchaseItem.productionItem.id },
        data: {
          ...(productId ? {
            productId,
            gramsPerPack: newProduct.gramsPerUnit,
            piecesPerUnit: newProduct.piecesPerUnit,
            piecesPerPack: newProduct.piecesPerPack,
          } : {}),
          plannedQty: newPlanned,
        },
      });
    }
  }

  // Cập nhật lại totalVnd của PurchaseOrder
  await recalcOrderTotal(purchaseOrderId);

  return Response.json({ ok: true });
}

// ── POST: thêm dòng hàng mới ─────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: purchaseOrderId } = await params;
  const body = await req.json();
  const { productId, quantity, priceVnd, notes } = body;

  if (!productId || !quantity || priceVnd === undefined) {
    return Response.json({ error: "Cần truyền productId, quantity, priceVnd" }, { status: 400 });
  }

  const qty = Number(quantity);
  const price = Number(priceVnd);
  const subtotal = qty * price;

  const newItem = await prisma.purchaseItem.create({
    data: {
      purchaseOrderId,
      productId,
      quantity: qty,
      priceVnd: price,
      subtotalVnd: subtotal,
      notes: notes || null,
    },
  });

  // Nếu đơn đã có productionOrder → thêm productionItem mới
  const productionOrder = await prisma.productionOrder.findUnique({
    where: { purchaseOrderId },
    select: { id: true },
  });
  if (productionOrder) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { unit: true, gramsPerUnit: true, piecesPerUnit: true, piecesPerPack: true },
    });
    if (product) {
      await prisma.productionItem.create({
        data: {
          productionOrderId: productionOrder.id,
          purchaseItemId: newItem.id,
          productId,
          gramsPerPack: product.gramsPerUnit,
          piecesPerUnit: product.piecesPerUnit,
          piecesPerPack: product.piecesPerPack,
          plannedQty: calcPlannedQty(
            qty,
            product.unit,
            product.gramsPerUnit,
            product.piecesPerUnit,
            product.piecesPerPack,
          ),
        },
      });
    }
  }

  await recalcOrderTotal(purchaseOrderId);
  return Response.json(newItem, { status: 201 });
}

// ── DELETE: xoá 1 dòng hàng ──────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: purchaseOrderId } = await params;
  const { itemId } = await req.json();

  if (!itemId) return Response.json({ error: "Cần truyền itemId" }, { status: 400 });

  // Xoá ProductionItem trước (nếu có) vì không có cascade từ PurchaseItem
  await prisma.productionItem.deleteMany({ where: { purchaseItemId: itemId } });

  await prisma.purchaseItem.delete({
    where: { id: itemId, purchaseOrderId },
  });

  await recalcOrderTotal(purchaseOrderId);
  return Response.json({ ok: true });
}

// ── Helper: tính lại totalVnd cho đơn ────────────────────────────────────────
async function recalcOrderTotal(purchaseOrderId: string) {
  const items = await prisma.purchaseItem.findMany({
    where: { purchaseOrderId },
    select: { subtotalVnd: true },
  });
  const totalVnd = items.reduce((s, i) => s + i.subtotalVnd, 0);
  await prisma.purchaseOrder.update({
    where: { id: purchaseOrderId },
    data: { totalVnd },
  });
}
