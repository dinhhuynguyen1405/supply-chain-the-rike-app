import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const item = await prisma.purchaseResearch.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.priority !== undefined
        ? { priority: Number(body.priority) }
        : {}),
      ...(body.targetPriceVnd !== undefined
        ? {
            targetPriceVnd: body.targetPriceVnd
              ? Number(body.targetPriceVnd)
              : null,
          }
        : {}),
      ...(body.targetQty !== undefined
        ? { targetQty: body.targetQty ? Number(body.targetQty) : null }
        : {}),
      ...(body.qualityNotes !== undefined
        ? { qualityNotes: body.qualityNotes || null }
        : {}),
      ...(body.sourceNotes !== undefined
        ? { sourceNotes: body.sourceNotes || null }
        : {}),
      ...(body.generalNotes !== undefined
        ? { generalNotes: body.generalNotes || null }
        : {}),
      ...(body.productName !== undefined
        ? { productName: body.productName }
        : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
    },
    include: {
      prices: true,
      product: { select: { id: true, name: true, nameVi: true } },
    },
  });

  return Response.json(item);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.purchaseResearch.delete({ where: { id } });
  return Response.json({ ok: true });
}
