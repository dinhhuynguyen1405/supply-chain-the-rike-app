import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { generateProductionCode, calcPlannedQty } from "@/lib/utils";
import { triggerSheetSync } from "@/lib/sync-trigger";

const include = {
  purchaseOrder: { include: { supplier: true } },
  items: { include: { product: true, purchaseItem: true } },
  costs: { orderBy: { createdAt: "asc" as const } },
} as const;

export async function GET() {
  const orders = await prisma.productionOrder.findMany({
    orderBy: { createdAt: "desc" },
    include,
  });
  return Response.json(orders);
}

/**
 * POST /api/production
 * Body: { purchaseOrderId }
 * Tự động tính plannedQty và tạo các khoản chi phí từ đơn mua.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { purchaseOrderId } = body;

  // Kiểm tra đã có lệnh sản xuất chưa
  const existing = await prisma.productionOrder.findUnique({ where: { purchaseOrderId } });
  if (existing) {
    return Response.json({ error: "Đơn mua này đã có lệnh sản xuất." }, { status: 409 });
  }

  // Lấy đơn mua + items + product
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: { items: { include: { product: true } } },
  });
  if (!purchaseOrder || purchaseOrder.items.length === 0) {
    return Response.json({ error: "Đơn mua không có sản phẩm." }, { status: 400 });
  }

  // Tự động tạo các khoản chi phí từ đơn mua
  const autoCosts: {
    type: string;
    description: string;
    amountVnd: number;
    purchaseOrderId: string;
  }[] = [];

  // Chi phí nguyên liệu — từng dòng sản phẩm
  for (const pi of purchaseOrder.items) {
    autoCosts.push({
      type: "material",
      description: `${pi.product.nameVi ?? pi.product.name} (${pi.quantity} ${pi.product.unit})`,
      amountVnd: pi.subtotalVnd,
      purchaseOrderId,
    });
  }

  // Phí ship mua nguyên liệu (nếu có)
  if (purchaseOrder.shippingCostVnd) {
    autoCosts.push({
      type: "shipping",
      description: `Phí ship nguyên liệu (${purchaseOrder.shippingUnit ?? ""} ${purchaseOrder.shippingCode ?? ""}`.trim() + ")",
      amountVnd: purchaseOrder.shippingCostVnd,
      purchaseOrderId,
    });
  }

  const production = await prisma.productionOrder.create({
    data: {
      code: generateProductionCode(),
      purchaseOrderId,
      status: "pending",
      items: {
        create: purchaseOrder.items.map((pi) => ({
          purchaseItemId: pi.id,
          productId: pi.productId,
          gramsPerPack:  pi.product.gramsPerUnit,
          piecesPerUnit: pi.product.piecesPerUnit,
          piecesPerPack: pi.product.piecesPerPack,
          plannedQty: calcPlannedQty(
            pi.quantity,
            pi.product.unit,
            pi.product.gramsPerUnit,
            pi.product.piecesPerUnit,
            pi.product.piecesPerPack,
          ),
        })),
      },
      costs: { create: autoCosts },
    },
    include,
  });

  triggerSheetSync("production");
  return Response.json(production, { status: 201 });
}
