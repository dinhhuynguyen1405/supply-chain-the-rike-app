import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return new Response(null, { status: 404 });
  return Response.json(product);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Support partial updates: only include fields that are explicitly present in the body
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};
  if ("name" in body) data.name = body.name;
  if ("nameVi" in body) data.nameVi = body.nameVi || null;
  if ("skuShopify" in body) data.skuShopify = body.skuShopify || null;
  if ("skuTiktok" in body) data.skuTiktok = body.skuTiktok || null;
  if ("skuAmz" in body) data.skuAmz = body.skuAmz || null;
  if ("unit" in body) data.unit = body.unit || "kg";
  if ("gramsPerUnit" in body)  data.gramsPerUnit  = body.gramsPerUnit  ? Number(body.gramsPerUnit)  : null;
  if ("piecesPerUnit" in body) data.piecesPerUnit = body.piecesPerUnit ? Number(body.piecesPerUnit) : null;
  if ("piecesPerPack" in body) data.piecesPerPack = body.piecesPerPack ? Number(body.piecesPerPack) : null;
  if ("restockThreshold" in body) data.restockThreshold = body.restockThreshold != null ? Number(body.restockThreshold) : 10;
  if ("category" in body) data.category = body.category || null;
  if ("notes" in body) data.notes = body.notes || null;

  const product = await prisma.product.update({ where: { id }, data });
  triggerSheetSync("products");
  return Response.json(product);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  triggerSheetSync("products");
  return new Response(null, { status: 204 });
}
