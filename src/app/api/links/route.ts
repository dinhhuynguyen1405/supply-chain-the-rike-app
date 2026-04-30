import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const items = await prisma.salesItem.findMany({
    where: { purchaseItemId: { not: null } },
    include: {
      product: true,
      purchaseItem: { include: { purchaseOrder: { include: { supplier: true } } } },
      batch: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(items);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // body: { salesItemId, purchaseItemId }
  const updated = await prisma.salesItem.update({
    where: { id: body.salesItemId },
    data: { purchaseItemId: body.purchaseItemId },
    include: {
      product: true,
      purchaseItem: { include: { purchaseOrder: true } },
    },
  });
  return Response.json(updated);
}
