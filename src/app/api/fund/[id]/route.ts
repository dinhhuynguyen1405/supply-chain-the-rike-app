import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.fundTransaction.delete({ where: { id } });
  return Response.json({ ok: true });
}
