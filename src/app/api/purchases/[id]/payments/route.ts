import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const payment = await prisma.payment.create({
    data: {
      purchaseOrderId: id,
      direction: body.direction || "to_supplier",
      amount: body.amount,
      currency: body.currency || "VND",
      paidAt: new Date(body.paidAt),
      method: body.method || null,
      notes: body.notes || null,
    },
  });
  triggerSheetSync("purchases");
  return Response.json(payment, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: _orderId } = await params;
  const { paymentId } = await req.json();
  await prisma.payment.delete({ where: { id: paymentId } });
  triggerSheetSync("purchases");
  return new Response(null, { status: 204 });
}
