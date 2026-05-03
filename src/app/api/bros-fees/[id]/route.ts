import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const fee = await prisma.brosFee.update({
    where: { id },
    data: {
      ...(body.type !== undefined && { type: body.type }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.amountUsd !== undefined && { amountUsd: Number(body.amountUsd) }),
      ...(body.amountVnd !== undefined && { amountVnd: body.amountVnd ? Number(body.amountVnd) : null }),
      ...(body.sku !== undefined && { sku: body.sku || null }),
      ...(body.quantity !== undefined && { quantity: body.quantity ? Number(body.quantity) : null }),
      ...(body.paidAt !== undefined && { paidAt: body.paidAt ? new Date(body.paidAt) : null }),
      ...(body.note !== undefined && { note: body.note || null }),
    },
  });
  return Response.json(fee);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.brosFee.delete({ where: { id } });
  return Response.json({ ok: true });
}
