/**
 * POST /api/products/[id]/publish-shopify
 *
 * Creates a new Shopify product from the DB product and links the SKU back.
 *
 * Body:
 *   { sku: string, priceUsd: number, status?: "draft" | "active" }
 *
 * Returns:
 *   { ok, shopifyProductId, sku, adminUrl }
 */
import { prisma } from "@/lib/prisma";
import { getShopifyConfig, createProduct } from "@/lib/shopify";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const { sku, priceUsd, status = "draft" } = body as {
    sku: string;
    priceUsd?: number;
    status?: "draft" | "active";
  };

  if (!sku?.trim()) {
    return Response.json({ error: "SKU không được để trống" }, { status: 400 });
  }

  // Fetch product from DB
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return Response.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
  }

  // Get Shopify config
  const cfg = await getShopifyConfig();
  if (!cfg) {
    return Response.json(
      { error: "Chưa cấu hình Shopify. Vào Settings → Kết nối Shopify." },
      { status: 400 }
    );
  }

  const skuClean = sku.trim().toUpperCase();
  const price = priceUsd ? String(Number(priceUsd).toFixed(2)) : "0.00";

  // Create product on Shopify
  const result = await createProduct(cfg, {
    title: product.name,
    bodyHtml: product.notes ? `<p>${product.notes}</p>` : "",
    vendor: "The Rike",
    tags: [product.category, "rike-import"].filter(Boolean).join(", "),
    status,
    variants: [
      {
        price,
        sku: skuClean,
        inventoryManagement: "shopify",
        inventoryPolicy: "deny",
      },
    ],
  });

  if (!result.ok) {
    return Response.json(
      { error: `Shopify trả lỗi: ${result.error}` },
      { status: 502 }
    );
  }

  // Save SKU back to DB
  await prisma.product.update({
    where: { id },
    data: {
      skuShopify: skuClean,
      priceUsd: priceUsd ? Number(priceUsd) : product.priceUsd,
    },
  });

  const adminUrl = `https://${cfg.domain}/admin/products/${result.shopifyProductId}`;

  return Response.json({
    ok: true,
    shopifyProductId: result.shopifyProductId,
    sku: skuClean,
    adminUrl,
    status,
  });
}
