/**
 * GET /api/shopify/image-map
 * ─────────────────────────────────────────────────────────────────────────────
 * Trả về map: { [skuShopify]: imageUrl } từ Shopify.
 * Đồng thời cache imageUrl + priceUsd vào bảng Product (ghi vào DB background).
 *
 * Dùng bởi trang Sản phẩm và Tồn kho để hiển thị ảnh thumbnail.
 * Nếu Shopify chưa cấu hình → trả { } (không lỗi).
 */

import { prisma } from "@/lib/prisma";
import { getShopifyConfig } from "@/lib/shopify";

interface ShopifyVariant { id: number; sku: string; price: string }
interface ShopifyImage   { src: string }
interface ShopifyProduct {
  id: number;
  title: string;
  variants: ShopifyVariant[];
  images: ShopifyImage[];
}

export async function GET() {
  const cfg = await getShopifyConfig();
  if (!cfg) return Response.json({});

  // Fetch all products from Shopify (paginated)
  const imageMap: Record<string, string>  = {}; // sku → imageUrl
  const priceMap: Record<string, number>  = {}; // sku → priceUsd
  let pageUrl = `https://${cfg.domain}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants,images`;

  while (pageUrl) {
    const res = await fetch(pageUrl, {
      headers: { "X-Shopify-Access-Token": cfg.accessToken },
    });
    if (!res.ok) break;
    const data = await res.json();
    const products: ShopifyProduct[] = data.products ?? [];

    for (const p of products) {
      const imgUrl = p.images?.[0]?.src ?? null;
      for (const v of p.variants) {
        if (!v.sku) continue;
        if (imgUrl) imageMap[v.sku] = imgUrl;
        priceMap[v.sku] = parseFloat(v.price);
      }
    }

    const link = res.headers.get("Link") ?? "";
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    pageUrl = next ? next[1] : "";
  }

  // Cache imageUrl + priceUsd vào DB cho những sản phẩm chưa có
  // (fire-and-forget — không block response)
  void (async () => {
    try {
      const products = await prisma.product.findMany({
        where: { skuShopify: { not: null } },
        select: { id: true, skuShopify: true, imageUrl: true, priceUsd: true },
      });
      for (const p of products) {
        if (!p.skuShopify) continue;
        const newImg   = imageMap[p.skuShopify] ?? null;
        const newPrice = priceMap[p.skuShopify]  ?? null;
        if (
          (newImg && newImg !== p.imageUrl) ||
          (newPrice != null && newPrice !== p.priceUsd)
        ) {
          await prisma.product.update({
            where: { id: p.id },
            data: {
              ...(newImg   ? { imageUrl: newImg }   : {}),
              ...(newPrice != null ? { priceUsd: newPrice } : {}),
            },
          });
        }
      }
    } catch { /* không block */ }
  })();

  return Response.json(imageMap);
}
