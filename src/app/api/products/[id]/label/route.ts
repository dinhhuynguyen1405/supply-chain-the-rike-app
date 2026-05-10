/**
 * PUT    /api/products/[id]/label   — Lưu Drive URL cho ảnh label
 *        body: { driveUrl: string | null }
 * DELETE /api/products/[id]/label   — Xoá label (set null)
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { driveUrlToEmbed } from "@/lib/utils";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const raw = (body.driveUrl as string | null | undefined)?.trim() || null;

  const updated = await prisma.product.update({
    where: { id },
    data: {
      labelDriveUrl: raw,
      // labelImageUrl giờ lưu embed URL để dùng trong <img>
      labelImageUrl: raw ? driveUrlToEmbed(raw) : null,
    },
    select: { id: true, labelImageUrl: true, labelDriveUrl: true },
  });

  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const updated = await prisma.product.update({
    where: { id },
    data: { labelImageUrl: null, labelDriveUrl: null },
    select: { id: true, labelImageUrl: true, labelDriveUrl: true },
  });

  return Response.json(updated);
}
