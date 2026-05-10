/**
 * POST /api/products/[id]/label  — Upload ảnh label (multipart/form-data)
 * DELETE /api/products/[id]/label — Xoá label image
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const LABELS_DIR = join(process.cwd(), "public", "labels");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, labelImageUrl: true } });
  if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return Response.json({ error: "Chỉ hỗ trợ JPG, PNG, WebP, GIF" }, { status: 400 });
  }

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "File quá lớn, tối đa 5MB" }, { status: 400 });
  }

  // Delete old label file if exists
  if (product.labelImageUrl) {
    try {
      const oldPath = join(process.cwd(), "public", product.labelImageUrl.replace(/^\//, ""));
      if (existsSync(oldPath)) await unlink(oldPath);
    } catch { /* ignore */ }
  }

  // Save new file with product id as name
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `label-${id}.${ext}`;
  const bytes = await file.arrayBuffer();
  await writeFile(join(LABELS_DIR, filename), Buffer.from(bytes));

  const labelImageUrl = `/labels/${filename}`;

  const updated = await prisma.product.update({
    where: { id },
    data: { labelImageUrl },
    select: { id: true, labelImageUrl: true, labelDriveUrl: true },
  });

  return Response.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id }, select: { labelImageUrl: true } });
  if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

  if (product.labelImageUrl) {
    try {
      const filePath = join(process.cwd(), "public", product.labelImageUrl.replace(/^\//, ""));
      if (existsSync(filePath)) await unlink(filePath);
    } catch { /* ignore */ }
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { labelImageUrl: null },
    select: { id: true, labelImageUrl: true, labelDriveUrl: true },
  });

  return Response.json(updated);
}
