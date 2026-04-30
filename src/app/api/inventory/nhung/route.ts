import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";

// ─── Helpers để gọi Shopify API ──────────────────────────────────────────────

async function getShopifyConfig() {
  const settings = await prisma.setting.findMany();
  const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
  const domainRaw = config.shopifyStoreDomain || process.env.SHOPIFY_STORE_DOMAIN;
  const domain = domainRaw?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const accessToken = config.shopifyAccessToken || config.shopifyApiSecret || process.env.SHOPIFY_API_SECRET;
  return { domain, accessToken };
}

/**
 * Lấy map: skuShopify → { variantId, inventoryItemId }
 */
async function getShopifyVariantMap(domain: string, accessToken: string) {
  const map: Record<string, { variantId: string; inventoryItemId: string }> = {};
  let pageUrl: string | null = `https://${domain}/admin/api/2024-01/products.json?limit=250&fields=id,variants`;
  while (pageUrl) {
    const resp: Response = await fetch(pageUrl, { headers: { "X-Shopify-Access-Token": accessToken } });
    if (!resp.ok) break;
    const data = await resp.json();
    for (const p of data.products ?? []) {
      for (const v of p.variants ?? []) {
        if (v.sku) {
          map[v.sku] = { variantId: String(v.id), inventoryItemId: String(v.inventory_item_id) };
        }
      }
    }
    const link: string = resp.headers.get("Link") ?? "";
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    pageUrl = next ? next[1] : null;
  }
  return map;
}

/**
 * Lấy location ID đầu tiên của shop (nơi có hàng)
 */
async function getShopifyLocationId(domain: string, accessToken: string): Promise<string | null> {
  const resp = await fetch(`https://${domain}/admin/api/2024-01/locations.json`, {
    headers: { "X-Shopify-Access-Token": accessToken },
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const loc = data.locations?.[0];
  return loc ? String(loc.id) : null;
}

/**
 * Set inventory level cho 1 item tại 1 location
 */
async function setShopifyInventory(
  domain: string,
  accessToken: string,
  inventoryItemId: string,
  locationId: string,
  available: number
) {
  const resp = await fetch(`https://${domain}/admin/api/2024-01/inventory_levels/set.json`, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inventory_item_id: inventoryItemId, location_id: locationId, available }),
  });
  return resp.ok;
}

// ─── GET /api/inventory/nhung ─────────────────────────────────────────────────
// Trả về danh sách sản phẩm kèm nhungQty, brosQty, shopifyQty, total

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { nameVi: "asc" },
    select: {
      id: true,
      name: true,
      nameVi: true,
      skuShopify: true,
      skuAmz: true,
      nhungQty: true,
    },
  });

  // Kho Bros từ WarehouseStock
  const brosStocks = await prisma.warehouseStock.findMany({ where: { warehouse: "bros" } });
  const brosMap: Record<string, number> = {};
  for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

  // Shopify inventory
  let shopifyMap: Record<string, number> = {};
  try {
    const { domain, accessToken } = await getShopifyConfig();
    if (domain && accessToken) {
      let pageUrl: string | null = `https://${domain}/admin/api/2024-01/products.json?limit=250&fields=id,variants`;
      while (pageUrl) {
        const resp: Response = await fetch(pageUrl, { headers: { "X-Shopify-Access-Token": accessToken } });
        if (!resp.ok) break;
        const data = await resp.json();
        for (const p of data.products ?? []) {
          for (const v of p.variants ?? []) {
            if (v.sku) shopifyMap[v.sku] = (shopifyMap[v.sku] ?? 0) + (v.inventory_quantity ?? 0);
          }
        }
        const link = resp.headers.get("Link") ?? "";
        const next = link.match(/<([^>]+)>;\s*rel="next"/);
        pageUrl = next ? next[1] : null;
      }
    }
  } catch {
    shopifyMap = {};
  }

  const result = products.map((p) => {
    const brosQty = (p.skuAmz ? brosMap[p.skuAmz] : null) ?? (p.skuShopify ? brosMap[p.skuShopify] : null) ?? 0;
    const shopifyQty = p.skuShopify ? (shopifyMap[p.skuShopify] ?? null) : null;
    return {
      id: p.id,
      name: p.name,
      nameVi: p.nameVi,
      skuShopify: p.skuShopify,
      skuAmz: p.skuAmz,
      nhungQty: p.nhungQty,
      brosQty,
      shopifyQty,
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
      prisma.product.update({ where: { id }, data: { nhungQty: Math.max(0, nhungQty) } })
    )
  );

  // 2. Sync lên Shopify: qty mới = nhungQty + brosQty
  const shopifyErrors: string[] = [];
  try {
    const { domain, accessToken } = await getShopifyConfig();
    if (domain && accessToken) {
      const [variantMap, locationId, brosStocks] = await Promise.all([
        getShopifyVariantMap(domain, accessToken),
        getShopifyLocationId(domain, accessToken),
        prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
      ]);

      const brosMap: Record<string, number> = {};
      for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

      // Lấy products đã cập nhật để biết nhungQty mới + skuShopify
      const updatedIds = body.map((b) => b.id);
      const products = await prisma.product.findMany({
        where: { id: { in: updatedIds } },
        select: { id: true, skuShopify: true, skuAmz: true, nhungQty: true },
      });

      if (locationId) {
        for (const p of products) {
          if (!p.skuShopify) continue;
          const variant = variantMap[p.skuShopify];
          if (!variant) continue;
          const brosQty = (p.skuAmz ? brosMap[p.skuAmz] : null) ?? brosMap[p.skuShopify] ?? 0;
          const totalQty = Math.round(p.nhungQty + brosQty);
          const ok = await setShopifyInventory(domain, accessToken, variant.inventoryItemId, locationId, totalQty);
          if (!ok) shopifyErrors.push(p.skuShopify);
        }
      }
    }
  } catch (e) {
    console.warn("[nhung] Shopify push error:", e);
    shopifyErrors.push("(shopify unreachable)");
  }

  // 3. Sync Google Sheet tab Kho Nhung
  triggerSheetSync("nhung");

  return Response.json({
    updated: body.length,
    shopifyErrors: shopifyErrors.length > 0 ? shopifyErrors : null,
  });
}

// ─── POST /api/inventory/nhung/init ──────────────────────────────────────────
// Khởi tạo nhungQty = Shopify hiện tại (chạy 1 lần đầu)

export async function POST() {
  try {
    const { domain, accessToken } = await getShopifyConfig();
    if (!domain || !accessToken) {
      return Response.json({ error: "Chưa cấu hình Shopify" }, { status: 400 });
    }

    // Lấy qty từ Shopify
    const shopifyMap: Record<string, number> = {};
    let pageUrl: string | null = `https://${domain}/admin/api/2024-01/products.json?limit=250&fields=id,variants`;
    while (pageUrl) {
      const resp: Response = await fetch(pageUrl, { headers: { "X-Shopify-Access-Token": accessToken } });
      if (!resp.ok) break;
      const data = await resp.json();
      for (const p of data.products ?? []) {
        for (const v of p.variants ?? []) {
          if (v.sku) shopifyMap[v.sku] = (shopifyMap[v.sku] ?? 0) + (v.inventory_quantity ?? 0);
        }
      }
      const link = resp.headers.get("Link") ?? "";
      const next = link.match(/<([^>]+)>;\s*rel="next"/);
      pageUrl = next ? next[1] : null;
    }

    // Update nhungQty cho từng sản phẩm có skuShopify
    const products = await prisma.product.findMany({ where: { skuShopify: { not: null } } });
    let count = 0;
    for (const p of products) {
      if (!p.skuShopify) continue;
      const qty = shopifyMap[p.skuShopify] ?? 0;
      await prisma.product.update({ where: { id: p.id }, data: { nhungQty: qty } });
      count++;
    }

    triggerSheetSync("nhung");
    return Response.json({ initialized: count, message: `Đã set nhungQty = Shopify qty cho ${count} sản phẩm` });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
