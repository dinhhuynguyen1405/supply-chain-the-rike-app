import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      name: body.name,
      phone: body.phone || null,
      location: body.location || null,
      notes: body.notes || null,
    },
  });
  return Response.json(supplier);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.supplier.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
