/**
 * /api/bros-fees
 * Quản lý phí kho Bros (inbound, storage, fulfillment, return, other)
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const fees = await prisma.brosFee.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Tổng hợp theo loại
  const summary = fees.reduce(
    (acc, f) => {
      acc.totalUsd += f.amountUsd;
      acc.byType[f.type] = (acc.byType[f.type] ?? 0) + f.amountUsd;
      return acc;
    },
    { totalUsd: 0, byType: {} as Record<string, number> }
  );

  return Response.json({ fees, summary });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.type || !body.description || body.amountUsd === undefined) {
    return Response.json(
      { error: "Cần có: type, description, amountUsd" },
      { status: 400 }
    );
  }

  const fee = await prisma.brosFee.create({
    data: {
      type: body.type,
      description: body.description,
      amountUsd: Number(body.amountUsd),
      amountVnd: body.amountVnd ? Number(body.amountVnd) : null,
      shipmentBatchId: body.shipmentBatchId || null,
      fulfillmentOrderId: body.fulfillmentOrderId || null,
      sku: body.sku || null,
      quantity: body.quantity ? Number(body.quantity) : null,
      paidAt: body.paidAt ? new Date(body.paidAt) : null,
      note: body.note || null,
    },
  });

  return Response.json(fee, { status: 201 });
}
