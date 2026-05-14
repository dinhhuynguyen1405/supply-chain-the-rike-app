import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// PUT /api/product-groups/[id] — update group name, baseCostVnd, costUnit, notes
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if ("name" in body) data.name = body.name.trim();
  if ("baseCostVnd" in body) data.baseCostVnd = body.baseCostVnd ? Number(body.baseCostVnd) : null;
  if ("costUnit" in body) data.costUnit = body.costUnit || "kg";
  if ("notes" in body) data.notes = body.notes || null;

  try {
    const group = await prisma.productGroup.update({
      where: { id },
      data,
      include: {
        products: {
          select: {
            id: true,
            name: true,
            nameVi: true,
            skuShopify: true,
            priceUsd: true,
            imageUrl: true,
            gramsPerUnit: true,
            nhungQty: true,
          },
        },
      },
    });
    return Response.json(group);
  } catch {
    return Response.json({ error: "Không tìm thấy nhóm" }, { status: 404 });
  }
}

// DELETE /api/product-groups/[id] — delete group (products remain, groupId → null)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Unlink products first
  await prisma.product.updateMany({ where: { groupId: id }, data: { groupId: null } });
  await prisma.productGroup.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
