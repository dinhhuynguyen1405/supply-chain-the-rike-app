/**
 * /api/shopify/products
 * ─────────────────────────────────────────────────────────────────────────────
 * Quản lý sản phẩm trực tiếp trên Shopify từ trong app.
 *
 * GET  → Lấy toàn bộ sản phẩm Shopify, enrich với dữ liệu local (nhungQty, brosQty, COGS...)
 * POST → Tạo sản phẩm mới trên Shopify (dùng khi thêm mã hàng từ kho Bros)
 */

import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  getShopifyConfig,
  getAllProducts,
  createProduct,
  getLocationId,
} from "@/lib/shopify";

// ─── GET /api/shopify/products ────────────────────────────────────────────────

export async function GET() {
  const cfg = await getShopifyConfig();
  if (!cfg) {
    return Response.json(
      { error: "Chưa cấu hình Shopify. Vào Cài đặt để kết nối." },
      { status: 400 }
    );
  }

  // Lấy sản phẩm từ Shopify
  const shopifyProducts = await getAllProducts(cfg);

  // Lấy dữ liệu local để enrich
  const [localProducts, brosStocks] = await Promise.all([
    prisma.product.findMany({
      select: {
        id: true,
        nameVi: true,
        skuShopify: true,
        skuAmz: true,
        nhungQty: true,
        gramsPerUnit: true,
        category: true,
      },
    }),
    prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
  ]);

  // Build lookup maps
  const localByShopifySku: Record<string, (typeof localProducts)[0]> = {};
  for (const p of localProducts) {
    if (p.skuShopify) localByShopifySku[p.skuShopify] = p;
  }

  const brosMap: Record<string, number> = {};
  for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

  // Enrich Shopify products with local data
  const result = shopifyProducts.map((sp) => {
    const firstVariant = sp.variants[0];
    const sku = firstVariant?.sku ?? "";
    const local = localByShopifySku[sku];
    const nhungQty = local?.nhungQty ?? 0;
    const brosQty = local
      ? ((local.skuAmz ? brosMap[local.skuAmz] : null) ?? brosMap[sku] ?? 0)
      : 0;
    const shopifyQty = firstVariant?.inventoryQty ?? 0;
    const expectedQty = nhungQty + brosQty;
    const qtyMismatch = Math.abs(shopifyQty - expectedQty) > 0;

    return {
      shopifyId: sp.id,
      title: sp.title,
      nameVi: local?.nameVi ?? null,
      status: sp.status,
      vendor: sp.vendor,
      tags: sp.tags,
      imageUrl: sp.imageUrl,
      localProductId: local?.id ?? null,
      variants: sp.variants.map((v) => ({
        variantId: v.variantId,
        inventoryItemId: v.inventoryItemId,
        sku: v.sku,
        price: v.price,
        inventoryQty: v.inventoryQty,
      })),
      // Inventory summary
      nhungQty,
      brosQty,
      expectedQty,
      shopifyQty,
      qtyMismatch, // true nếu Shopify qty ≠ nhungQty + brosQty → cần sync
      linkedLocally: !!local, // có liên kết với Product trong DB không
    };
  });

  return Response.json(result);
}

// ─── POST /api/shopify/products ───────────────────────────────────────────────
// Tạo sản phẩm mới trên Shopify (ví dụ: thêm mã hàng Bros lên Shopify)

export async function POST(req: NextRequest) {
  const cfg = await getShopifyConfig();
  if (!cfg) {
    return Response.json({ error: "Chưa cấu hình Shopify" }, { status: 400 });
  }

  const body = await req.json();

  // Validate
  if (!body.title || !body.sku || !body.price) {
    return Response.json(
      { error: "Cần có: title, sku, price" },
      { status: 400 }
    );
  }

  // 1. Tạo trên Shopify
  const result = await createProduct(cfg, {
    title: body.title,
    bodyHtml: body.description ?? "",
    vendor: body.vendor ?? "The Rike",
    tags: body.tags ?? "",
    status: body.status ?? "active",
    variants: [
      {
        price: String(body.price),
        sku: body.sku,
        inventoryManagement: "shopify",
        inventoryPolicy: "deny",
      },
    ],
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error ?? "Shopify API error" },
      { status: 500 }
    );
  }

  // 2. Set initial inventory nếu có
  if (result.inventoryItemId && (body.initialNhungQty || body.initialBrosQty)) {
    const locationId = await getLocationId(cfg);
    if (locationId) {
      const totalQty = (body.initialNhungQty ?? 0) + (body.initialBrosQty ?? 0);
      await fetch(
        `https://${cfg.domain}/admin/api/2024-01/inventory_levels/set.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": cfg.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inventory_item_id: result.inventoryItemId,
            location_id: locationId,
            available: Math.round(totalQty),
          }),
        }
      );
    }
  }

  // 3. Link to local Product nếu có localProductId
  if (body.localProductId && result.shopifyProductId) {
    await prisma.product.update({
      where: { id: body.localProductId },
      data: {
        skuShopify: body.sku,
        ...(body.initialNhungQty !== undefined && {
          nhungQty: Number(body.initialNhungQty),
        }),
      },
    });
  }

  // 4. Tạo WarehouseStock cho Bros nếu initialBrosQty > 0
  if (body.initialBrosQty && Number(body.initialBrosQty) > 0 && body.sku) {
    await prisma.warehouseStock.upsert({
      where: { sku_warehouse: { sku: body.sku, warehouse: "bros" } },
      update: { inStock: { increment: Number(body.initialBrosQty) } },
      create: {
        sku: body.sku,
        warehouse: "bros",
        description: body.title,
        inStock: Number(body.initialBrosQty),
        received: Number(body.initialBrosQty),
      },
    });
  }

  return Response.json(
    {
      ok: true,
      shopifyProductId: result.shopifyProductId,
      variantId: result.variantId,
      inventoryItemId: result.inventoryItemId,
    },
    { status: 201 }
  );
}
