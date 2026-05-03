import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const hasSku = searchParams.get("hasSku") === "1";
  const hasVi = searchParams.get("hasVi") === "1";
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") ?? 50)));

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { nameVi: { contains: search } },
      { skuShopify: { contains: search } },
      { category: { contains: search } },
    ];
  }
  if (category) where.category = { contains: category };
  if (hasSku) where.skuShopify = { not: null };
  if (hasVi) where.nameVi = { not: null };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ nameVi: "asc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  // Get distinct categories for filter
  const allCats = await prisma.product.findMany({
    select: { category: true },
    distinct: ["category"],
    where: { category: { not: null } },
    orderBy: { category: "asc" },
  });

  // Production inventory counts per product
  // pendingShipQty: đã đóng gói xong (production done), PO chưa vào ShipmentBatch nào
  // inTransitQty: PO đã vào ShipmentBatch chưa done (đang trên đường sang Mỹ)
  const productIds = products.map((p) => p.id);
  const [pendingItems, inTransitItems] = await Promise.all([
    prisma.productionItem.findMany({
      where: {
        productId: { in: productIds },
        actualQty: { not: null },
        productionOrder: { status: "done" },
        purchaseItem: { purchaseOrder: { shipmentOrders: { none: {} } } },
      },
      select: { productId: true, actualQty: true },
    }),
    prisma.productionItem.findMany({
      where: {
        productId: { in: productIds },
        actualQty: { not: null },
        productionOrder: { status: "done" },
        purchaseItem: {
          purchaseOrder: {
            shipmentOrders: {
              some: { shipmentBatch: { status: { notIn: ["done"] } } },
            },
          },
        },
      },
      select: { productId: true, actualQty: true },
    }),
  ]);

  const pendingMap = new Map<string, number>();
  for (const item of pendingItems) {
    if (item.actualQty != null)
      pendingMap.set(item.productId, (pendingMap.get(item.productId) ?? 0) + item.actualQty);
  }
  const inTransitMap = new Map<string, number>();
  for (const item of inTransitItems) {
    if (item.actualQty != null)
      inTransitMap.set(item.productId, (inTransitMap.get(item.productId) ?? 0) + item.actualQty);
  }

  const productsWithCounts = products.map((p) => ({
    ...p,
    pendingShipQty: pendingMap.get(p.id) ?? 0,
    inTransitQty: inTransitMap.get(p.id) ?? 0,
  }));

  return Response.json({
    products: productsWithCounts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    categories: allCats.map((c) => c.category).filter(Boolean),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const product = await prisma.product.create({
    data: {
      name: body.name,
      nameVi: body.nameVi || null,
      skuShopify: body.skuShopify || null,
      skuTiktok: body.skuTiktok || null,
      skuAmz: body.skuAmz || null,
      skuBros: body.skuBros || null,
      unit: body.unit || "kg",
      gramsPerUnit:  body.gramsPerUnit  ? Number(body.gramsPerUnit)  : null,
      piecesPerUnit: body.piecesPerUnit ? Number(body.piecesPerUnit) : null,
      piecesPerPack: body.piecesPerPack ? Number(body.piecesPerPack) : null,
      restockThreshold: body.restockThreshold != null ? Number(body.restockThreshold) : 10,
      category: body.category || null,
      notes: body.notes || null,
    },
  });
  triggerSheetSync("products");
  return Response.json(product, { status: 201 });
}
