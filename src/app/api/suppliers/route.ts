import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { purchaseOrders: true } } },
  });
  return Response.json(suppliers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supplier = await prisma.supplier.create({
    data: {
      name: body.name,
      phone: body.phone || null,
      location: body.location || null,
      notes: body.notes || null,
    },
  });
  return Response.json(supplier, { status: 201 });
}
