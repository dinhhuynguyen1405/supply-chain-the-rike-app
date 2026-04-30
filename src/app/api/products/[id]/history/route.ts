import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const items = await prisma.purchaseItem.findMany({
    where: { productId: id },
    orderBy: { purchaseOrder: { orderDate: "desc" } },
    include: {
      purchaseOrder: {
        include: {
          supplier: true,
          payments: true,
        },
      },
    },
  });

  return Response.json(items);
}
