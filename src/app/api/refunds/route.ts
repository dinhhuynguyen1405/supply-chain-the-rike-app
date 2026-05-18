import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const refunds = await prisma.salesRefund.findMany({
    orderBy: { refundedAt: "desc" },
  });

  const totalUsd = refunds.reduce((s, r) => s + r.amountUsd, 0);

  // Group by month
  const byMonth: Record<string, number> = {};
  for (const r of refunds) {
    const key = new Date(r.refundedAt).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
    });
    byMonth[key] = (byMonth[key] ?? 0) + r.amountUsd;
  }

  return Response.json({ refunds, totalUsd, byMonth });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const refund = await prisma.salesRefund.create({
    data: {
      source: body.source ?? "manual",
      shopifyOrderId: body.shopifyOrderId || null,
      orderName: body.orderName || null,
      amountUsd: Number(body.amountUsd),
      reason: body.reason || null,
      refundedAt: new Date(body.refundedAt),
      notes: body.notes || null,
    },
  });
  return Response.json(refund, { status: 201 });
}
