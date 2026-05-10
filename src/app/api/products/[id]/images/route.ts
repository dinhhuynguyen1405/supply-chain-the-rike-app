/**
 * GET    /api/products/[id]/images              — Lấy danh sách ảnh
 * POST   /api/products/[id]/images              — Thêm ảnh mới qua Drive URL
 *        body: { driveUrl, type?, altText? }
 * PATCH  /api/products/[id]/images              — Reorder hoặc update metadata
 *        body: { order: string[] }  |  { updateOne: { id, driveUrl?, altText? } }
 * DELETE /api/products/[id]/images?imageId=xxx  — Xoá 1 ảnh
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { driveUrlToEmbed } from "@/lib/utils";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const images = await prisma.productImage.findMany({
    where: { productId: id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return Response.json(images);
}

// ─── POST — thêm ảnh Drive URL ───────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
  if (!product) return Response.json({ error: "Product not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { driveUrl, type = "listing", altText } = body as {
    driveUrl?: string;
    type?: string;
    altText?: string;
  };

  if (!driveUrl?.trim()) {
    return Response.json({ error: "driveUrl là bắt buộc" }, { status: 400 });
  }

  // Giới hạn listing: tối đa 12 ảnh
  if (type === "listing") {
    const count = await prisma.productImage.count({ where: { productId: id, type: "listing" } });
    if (count >= 12) {
      return Response.json({ error: "Tối đa 12 ảnh listing" }, { status: 400 });
    }
  }

  // sortOrder = max + 1
  const last = await prisma.productImage.findFirst({
    where: { productId: id, type },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  // url = embed URL để hiển thị; driveUrl = link gốc để mở Drive
  const embedUrl = driveUrlToEmbed(driveUrl.trim());

  const image = await prisma.productImage.create({
    data: {
      productId: id,
      url: embedUrl,
      type,
      altText: altText?.trim() || null,
      driveUrl: driveUrl.trim(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });

  return Response.json(image, { status: 201 });
}

// ─── PATCH — reorder OR update metadata ──────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Reorder: body.order = [imageId1, imageId2, ...]
  if (Array.isArray(body.order)) {
    await Promise.all(
      (body.order as string[]).map((imgId, idx) =>
        prisma.productImage.updateMany({
          where: { id: imgId, productId: id },
          data: { sortOrder: idx },
        })
      )
    );
    const images = await prisma.productImage.findMany({
      where: { productId: id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return Response.json(images);
  }

  // Update one: body.updateOne = { id, driveUrl?, altText? }
  if (body.updateOne && typeof body.updateOne === "object") {
    const { id: imgId, driveUrl, altText } = body.updateOne as {
      id: string;
      driveUrl?: string | null;
      altText?: string | null;
    };

    const img = await prisma.productImage.findUnique({
      where: { id: imgId },
      select: { productId: true },
    });
    if (!img || img.productId !== id) {
      return Response.json({ error: "Image not found" }, { status: 404 });
    }

    const updated = await prisma.productImage.update({
      where: { id: imgId },
      data: {
        ...(driveUrl !== undefined && {
          driveUrl: driveUrl?.trim() || null,
          url: driveUrl?.trim() ? driveUrlToEmbed(driveUrl.trim()) : "",
        }),
        ...(altText !== undefined && { altText: altText?.trim() || null }),
      },
    });
    return Response.json(updated);
  }

  return Response.json(
    { error: "body.order array hoặc body.updateOne object là bắt buộc" },
    { status: 400 }
  );
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const imageId = searchParams.get("imageId");

  if (!imageId) return Response.json({ error: "imageId required" }, { status: 400 });

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: { id: true, productId: true },
  });

  if (!image || image.productId !== id) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  await prisma.productImage.delete({ where: { id: imageId } });
  return new Response(null, { status: 204 });
}
