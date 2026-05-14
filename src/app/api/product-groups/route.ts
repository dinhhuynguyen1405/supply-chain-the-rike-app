import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

// GET /api/product-groups — list all groups with their products
export async function GET() {
  const groups = await prisma.productGroup.findMany({
    include: {
      products: {
        select: {
          id: true,
          name: true,
          nameVi: true,
          skuShopify: true,
          skuAmz: true,
          skuBros: true,
          priceUsd: true,
          imageUrl: true,
          unit: true,
          gramsPerUnit: true,
          piecesPerUnit: true,
          piecesPerPack: true,
          nhungQty: true,
          category: true,
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  return Response.json(groups);
}

// POST /api/product-groups — create a new group
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name?.trim()) {
    return Response.json({ error: "Tên nhóm không được để trống" }, { status: 400 });
  }
  const group = await prisma.productGroup.create({
    data: {
      name: body.name.trim(),
      baseCostVnd: body.baseCostVnd ? Number(body.baseCostVnd) : null,
      costUnit: body.costUnit || "kg",
      notes: body.notes || null,
    },
    include: { products: true },
  });
  return Response.json(group, { status: 201 });
}
