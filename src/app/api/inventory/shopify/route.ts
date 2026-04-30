import { prisma } from "@/lib/prisma";

// Returns { [skuShopify]: inventory_quantity } from Shopify
export async function GET() {
  const settings = await prisma.setting.findMany();
  const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);

  const domainRaw = config.shopifyStoreDomain || process.env.SHOPIFY_STORE_DOMAIN;
  const domain = domainRaw?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const accessToken = config.shopifyAccessToken || config.shopifyApiSecret || process.env.SHOPIFY_API_SECRET;

  if (!domain || !accessToken) {
    return Response.json({ error: "Chưa cấu hình Shopify" }, { status: 400 });
  }

  const qtyMap: Record<string, number> = {};

  try {
    let pageUrl: string | null = `https://${domain}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`;
    while (pageUrl) {
      const resp: Response = await fetch(pageUrl, {
        headers: { "X-Shopify-Access-Token": accessToken },
      });
      if (!resp.ok) break;
      const data = await resp.json();
      for (const product of data.products ?? []) {
        for (const variant of product.variants ?? []) {
          if (variant.sku) {
            qtyMap[variant.sku] = (qtyMap[variant.sku] ?? 0) + (variant.inventory_quantity ?? 0);
          }
        }
      }
      const link: string = resp.headers.get("Link") ?? "";
      const next: RegExpMatchArray | null = link.match(/<([^>]+)>;\s*rel="next"/);
      pageUrl = next ? next[1] : null;
    }
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }

  return Response.json(qtyMap);
}
