import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: researchId } = await params;
  const body = await req.json();

  const price = await prisma.purchaseResearchPrice.create({
    data: {
      researchId,
      supplierName: body.supplierName || null,
      priceVnd: Number(body.priceVnd),
      unit: body.unit || "kg",
      quality: body.quality || null,
      isVerified: body.isVerified ?? false,
      notes: body.notes || null,
    },
  });

  return Response.json(price, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  await prisma.purchaseResearchPrice.delete({ where: { id: body.priceId } });
  return Response.json({ ok: true });
}
