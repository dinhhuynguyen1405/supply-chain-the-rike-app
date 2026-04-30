import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const transactions = await prisma.fundTransaction.findMany({
    orderBy: { date: "desc" },
    include: { purchaseOrder: { select: { code: true } } },
  });

  const totalNhungIn = transactions
    .filter((t) => t.type === "nhung_in")
    .reduce((sum, t) => sum + t.amountVnd, 0);

  const totalSpent = transactions
    .filter((t) => t.type === "spent")
    .reduce((sum, t) => sum + t.amountVnd, 0);

  const totalNhungOut = transactions
    .filter((t) => t.type === "nhung_out")
    .reduce((sum, t) => sum + t.amountVnd, 0);

  const balance = totalNhungIn - totalSpent - totalNhungOut;

  return Response.json({ transactions, summary: { totalNhungIn, totalSpent, totalNhungOut, balance } });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const transaction = await prisma.fundTransaction.create({
    data: {
      date: new Date(body.date),
      type: body.type,
      amountVnd: Number(body.amountVnd),
      description: body.description || null,
      purchaseOrderId: body.purchaseOrderId || null,
    },
    include: { purchaseOrder: { select: { code: true } } },
  });

  return Response.json(transaction, { status: 201 });
}
