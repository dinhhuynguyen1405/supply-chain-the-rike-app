import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";
import { getShopifyConfig, getVariantMap, getLocationId, pushTotalInventory } from "@/lib/shopify";

// ─── GET /api/inventory/nhung ─────────────────────────────────────────────────
// Trả về danh sách sản phẩm kèm nhungQty, brosQty, total
// NOTE: không gọi Shopify tại đây — shopifyQty = nhungQty + brosQty theo công thức

export async function GET() {
  const [products, brosStocks, productionItems] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ nameVi: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        nameVi: true,
        skuShopify: true,
        skuAmz: true,
        skuBros: true,
        nhungQty: true,
        imageUrl: true,
        priceUsd: true,
      },
    }),
    prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
    // Tồn kho VN = sản phẩm đã sản xuất xong, chưa ship sang Mỹ
    prisma.productionItem.findMany({
      where: {
        productionOrder: { status: "done" },
        actualQty: { not: null },
      },
      select: { productId: true, actualQty: true },
    }),
  ]);

  // brosQty map: sku → inStock
  const brosMap: Record<string, number> = {};
  for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

  // vnQty map: productId → actualQty (sum)
  const vnMap: Record<string, number> = {};
  for (const pi of productionItems) {
    if (pi.actualQty) vnMap[pi.productId] = (vnMap[pi.productId] ?? 0) + pi.actualQty;
  }

  const result = products.map((p) => {
    const brosQty =
      (p.skuBros   ? brosMap[p.skuBros]   : null) ??
      (p.skuAmz    ? brosMap[p.skuAmz]    : null) ??
      (p.skuShopify ? brosMap[p.skuShopify] : null) ??
      0;
    const vnQty = vnMap[p.id] ?? 0;
    return {
      id: p.id,
      name: p.name,
      nameVi: p.nameVi,
      skuShopify: p.skuShopify,
      imageUrl: p.imageUrl,
      priceUsd: p.priceUsd,
      nhungQty: p.nhungQty,
      brosQty,
      vnQty,
      total: p.nhungQty + brosQty,
    };
  });

  return Response.json(result);
}

// ─── PUT /api/inventory/nhung ─────────────────────────────────────────────────
// Body: [{ id, nhungQty }] — cập nhật từng sản phẩm và push lên Shopify

export async function PUT(req: NextRequest) {
  const body: { id: string; nhungQty: number }[] = await req.json();

  if (!Array.isArray(body) || body.length === 0) {
    return Response.json({ error: "Cần truyền mảng [{ id, nhungQty }]" }, { status: 400 });
  }

  // 1. Update DB
  await Promise.all(
    body.map(({ id, nhungQty }) =>
      prisma.product.update({
        where: { id },
        data: { nhungQty: Math.max(0, nhungQty) },
      })
    )
  );

  // 2. Push Shopify: qty = nhungQty + brosQty
  const shopifyErrors: string[] = [];
  try {
    const cfg = await getShopifyConfig();
    if (cfg) {
      const [variantMap, locationId, brosStocks] = await Promise.all([
        getVariantMap(cfg),
        getLocationId(cfg),
        prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
      ]);

      const brosMap: Record<string, number> = {};
      for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

      const updatedIds = body.map((b) => b.id);
      const products = await prisma.product.findMany({
        where: { id: { in: updatedIds } },
        select: { id: true, skuShopify: true, skuAmz: true, nhungQty: true },
      });

      if (locationId) {
        for (const p of products) {
          if (!p.skuShopify) continue;
          const brosQty =
            (p.skuAmz ? brosMap[p.skuAmz] : null) ?? brosMap[p.skuShopify] ?? 0;
          const total = Math.max(0, Math.round(p.nhungQty + brosQty));
          const r = await pushTotalInventory(cfg, variantMap, locationId, p.skuShopify, total);
          if (!r.ok) shopifyErrors.push(r.error ?? p.skuShopify);
        }
      }
    }
  } catch (e) {
    console.warn("[nhung] Shopify push error:", e);
    shopifyErrors.push("(shopify unreachable)");
  }

  triggerSheetSync("nhung");

  return Response.json({
    updated: body.length,
    shopifyErrors: shopifyErrors.length > 0 ? shopifyErrors : null,
  });
}

// ─── POST /api/inventory/nhung ────────────────────────────────────────────────
// Khởi tạo nhungQty = Shopify qty hiện tại (chạy 1 lần đầu)
// Tương đương agent action "init_nhung" nhưng accessible trực tiếp từ UI

export async function POST() {
  try {
    const cfg = await getShopifyConfig();
    if (!cfg) {
      return Response.json({ error: "Chưa cấu hình Shopify" }, { status: 400 });
    }

    const variantMap = await getVariantMap(cfg);
    const products = await prisma.product.findMany({ where: { skuShopify: { not: null } } });

    let count = 0;
    for (const p of products) {
      if (!p.skuShopify) continue;
      const variant = variantMap[p.skuShopify];
      if (!variant) continue;
      const qty = Math.max(0, variant.inventoryQty);
      await prisma.product.update({ where: { id: p.id }, data: { nhungQty: qty } });
      count++;
    }

    triggerSheetSync("nhung");
    return Response.json({
      initialized: count,
      message: `Đã set nhungQty = Shopify qty cho ${count} sản phẩm`,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
