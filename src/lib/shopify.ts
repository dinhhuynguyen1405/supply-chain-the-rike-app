/**
 * src/lib/shopify.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared Shopify Admin REST API helpers.
 *
 * Capabilities supported (2024-01 REST API):
 *  • Inventory  : set, adjust, get levels
 *  • Products   : list, create, update (title, body_html, status, tags, vendor)
 *  • Variants   : update (price, compare_at_price, sku, barcode, weight)
 *  • Images     : add image to product
 *
 * All functions take a pre-resolved ShopifyConfig so callers can share one
 * config object across multiple operations without re-fetching settings.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShopifyConfig {
  domain: string;
  accessToken: string;
}

export interface ShopifyVariantInfo {
  variantId: string;
  inventoryItemId: string;
  price: string;
  sku: string;
  inventoryQty: number;
}

export interface ShopifyProductInfo {
  id: string;
  title: string;
  bodyHtml: string;
  vendor: string;
  status: string; // "active" | "draft" | "archived"
  tags: string;
  variants: ShopifyVariantInfo[];
  imageUrl: string | null;
}

// ─── Config helper ───────────────────────────────────────────────────────────

export async function getShopifyConfig(): Promise<ShopifyConfig | null> {
  const settings = await prisma.setting.findMany();
  const cfg = settings.reduce(
    (acc, s) => ({ ...acc, [s.key]: s.value }),
    {} as Record<string, string>
  );

  // Domain: env var takes priority over DB (DB may have stale/wrong value)
  const domainRaw =
    process.env.SHOPIFY_STORE_DOMAIN ||
    cfg.shopifyStoreDomain;
  const domain = domainRaw
    ?.replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  // Access token: SHOPIFY_ACCESS_TOKEN env var is the canonical source;
  // fall back to DB shopifyAccessToken, then other env vars
  const accessToken =
    process.env.SHOPIFY_ACCESS_TOKEN ||   // atkn_* token from .env (highest priority)
    cfg.shopifyAccessToken ||              // DB setting (may be stale)
    cfg.shopifyApiSecret ||
    process.env.SHOPIFY_API_SECRET;

  if (!domain || !accessToken) return null;
  return { domain, accessToken };
}

// ─── Internal fetch helper ───────────────────────────────────────────────────

async function shopifyFetch(
  cfg: ShopifyConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `https://${cfg.domain}/admin/api/2024-01${path}`;
  return fetch(url, {
    ...options,
    headers: {
      "X-Shopify-Access-Token": cfg.accessToken,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

// ─── Inventory helpers ────────────────────────────────────────────────────────

/**
 * Get the first active location ID for the shop.
 */
export async function getLocationId(cfg: ShopifyConfig): Promise<string | null> {
  const resp = await shopifyFetch(cfg, "/locations.json");
  if (!resp.ok) return null;
  const data = await resp.json();
  const loc = (data.locations ?? []).find((l: { active: boolean }) => l.active) ?? data.locations?.[0];
  return loc ? String(loc.id) : null;
}

/**
 * Build a map: SKU → { variantId, inventoryItemId, price, inventoryQty }
 * Paginates through all products.
 */
export async function getVariantMap(
  cfg: ShopifyConfig
): Promise<Record<string, ShopifyVariantInfo>> {
  const map: Record<string, ShopifyVariantInfo> = {};
  let pageUrl: string | null = `/products.json?limit=250&fields=id,variants`;

  while (pageUrl) {
    const resp = await shopifyFetch(cfg, pageUrl.startsWith("/") ? pageUrl : `/${pageUrl}`);
    if (!resp.ok) break;
    const data = await resp.json();
    for (const p of data.products ?? []) {
      for (const v of p.variants ?? []) {
        if (v.sku) {
          map[v.sku] = {
            variantId: String(v.id),
            inventoryItemId: String(v.inventory_item_id),
            price: v.price ?? "0",
            sku: v.sku,
            inventoryQty: v.inventory_quantity ?? 0,
          };
        }
      }
    }
    const link = resp.headers.get("Link") ?? "";
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    // Next page URL is absolute — strip to path only
    if (next) {
      try {
        pageUrl = new URL(next[1]).pathname + new URL(next[1]).search;
      } catch {
        pageUrl = null;
      }
    } else {
      pageUrl = null;
    }
  }
  return map;
}

/**
 * Set inventory level for one item at one location (absolute).
 */
export async function setInventory(
  cfg: ShopifyConfig,
  inventoryItemId: string,
  locationId: string,
  available: number
): Promise<boolean> {
  const resp = await shopifyFetch(cfg, "/inventory_levels/set.json", {
    method: "POST",
    body: JSON.stringify({
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available: Math.max(0, Math.round(available)),
    }),
  });
  return resp.ok;
}

/**
 * Adjust inventory level by a delta (positive or negative).
 * Safer than set when multiple sources update concurrently.
 */
export async function adjustInventory(
  cfg: ShopifyConfig,
  inventoryItemId: string,
  locationId: string,
  delta: number
): Promise<boolean> {
  const resp = await shopifyFetch(cfg, "/inventory_levels/adjust.json", {
    method: "POST",
    body: JSON.stringify({
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available_adjustment: Math.round(delta),
    }),
  });
  return resp.ok;
}

/**
 * Push nhungQty + brosQty as the Shopify inventory level for a product.
 * Resolves the SKU → inventoryItemId mapping internally.
 *
 * @param skuShopify  Shopify SKU of the product
 * @param skuAmz      Amazon / Bros SKU (for WarehouseStock lookup)
 * @param nhungQty    Current Kho Nhung quantity
 * @param brosQtyOverride  If provided, use this instead of querying DB
 */
export async function pushTotalInventory(
  cfg: ShopifyConfig,
  variantMap: Record<string, ShopifyVariantInfo>,
  locationId: string,
  skuShopify: string,
  totalQty: number
): Promise<{ ok: boolean; error?: string }> {
  const variant = variantMap[skuShopify];
  if (!variant) {
    return { ok: false, error: `SKU not found on Shopify: ${skuShopify}` };
  }
  const ok = await setInventory(cfg, variant.inventoryItemId, locationId, totalQty);
  return ok ? { ok: true } : { ok: false, error: `Shopify API error for ${skuShopify}` };
}

// ─── Product / Variant helpers ────────────────────────────────────────────────

/**
 * Fetch ALL products from Shopify with full details.
 */
export async function getAllProducts(
  cfg: ShopifyConfig
): Promise<ShopifyProductInfo[]> {
  const products: ShopifyProductInfo[] = [];
  let pageUrl: string | null = "/products.json?limit=250";

  while (pageUrl) {
    const resp = await shopifyFetch(cfg, pageUrl);
    if (!resp.ok) break;
    const data = await resp.json();
    for (const p of data.products ?? []) {
      products.push({
        id: String(p.id),
        title: p.title,
        bodyHtml: p.body_html ?? "",
        vendor: p.vendor ?? "",
        status: p.status ?? "active",
        tags: p.tags ?? "",
        variants: (p.variants ?? []).map((v: Record<string, unknown>) => ({
          variantId: String(v.id),
          inventoryItemId: String(v.inventory_item_id),
          price: String(v.price ?? "0"),
          sku: String(v.sku ?? ""),
          inventoryQty: Number(v.inventory_quantity ?? 0),
        })),
        imageUrl: p.images?.[0]?.src ?? null,
      });
    }
    const link = resp.headers.get("Link") ?? "";
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    if (next) {
      try {
        pageUrl = new URL(next[1]).pathname + new URL(next[1]).search;
      } catch {
        pageUrl = null;
      }
    } else {
      pageUrl = null;
    }
  }
  return products;
}

/**
 * Update a Shopify product's basic info.
 * Only fields passed (non-undefined) will be updated.
 */
export async function updateProduct(
  cfg: ShopifyConfig,
  shopifyProductId: string,
  fields: {
    title?: string;
    bodyHtml?: string;
    vendor?: string;
    status?: "active" | "draft" | "archived";
    tags?: string;
  }
): Promise<{ ok: boolean; product?: ShopifyProductInfo; error?: string }> {
  const body: Record<string, unknown> = { id: shopifyProductId };
  if (fields.title !== undefined) body.title = fields.title;
  if (fields.bodyHtml !== undefined) body.body_html = fields.bodyHtml;
  if (fields.vendor !== undefined) body.vendor = fields.vendor;
  if (fields.status !== undefined) body.status = fields.status;
  if (fields.tags !== undefined) body.tags = fields.tags;

  const resp = await shopifyFetch(cfg, `/products/${shopifyProductId}.json`, {
    method: "PUT",
    body: JSON.stringify({ product: body }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    return { ok: false, error: err };
  }
  const data = await resp.json();
  const p = data.product;
  return {
    ok: true,
    product: {
      id: String(p.id),
      title: p.title,
      bodyHtml: p.body_html ?? "",
      vendor: p.vendor ?? "",
      status: p.status,
      tags: p.tags ?? "",
      variants: (p.variants ?? []).map((v: Record<string, unknown>) => ({
        variantId: String(v.id),
        inventoryItemId: String(v.inventory_item_id),
        price: String(v.price ?? "0"),
        sku: String(v.sku ?? ""),
        inventoryQty: Number(v.inventory_quantity ?? 0),
      })),
      imageUrl: p.images?.[0]?.src ?? null,
    },
  };
}

/**
 * Update a Shopify variant (price, SKU, barcode, weight).
 */
export async function updateVariant(
  cfg: ShopifyConfig,
  productId: string,
  variantId: string,
  fields: {
    price?: string;
    compareAtPrice?: string;
    sku?: string;
    barcode?: string;
    weightKg?: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  const body: Record<string, unknown> = { id: variantId };
  if (fields.price !== undefined) body.price = fields.price;
  if (fields.compareAtPrice !== undefined) body.compare_at_price = fields.compareAtPrice;
  if (fields.sku !== undefined) body.sku = fields.sku;
  if (fields.barcode !== undefined) body.barcode = fields.barcode;
  if (fields.weightKg !== undefined) {
    body.weight = fields.weightKg * 1000; // Shopify stores weight in grams
    body.weight_unit = "g";
  }

  const resp = await shopifyFetch(
    cfg,
    `/products/${productId}/variants/${variantId}.json`,
    { method: "PUT", body: JSON.stringify({ variant: body }) }
  );
  if (!resp.ok) {
    const err = await resp.text();
    return { ok: false, error: err };
  }
  return { ok: true };
}

/**
 * Create a new product on Shopify.
 * Returns the created product's Shopify ID and first variant ID.
 */
export async function createProduct(
  cfg: ShopifyConfig,
  fields: {
    title: string;
    bodyHtml?: string;
    vendor?: string;
    tags?: string;
    status?: "active" | "draft";
    variants: {
      price: string;
      sku: string;
      inventoryManagement?: "shopify" | null;
      inventoryPolicy?: "deny" | "continue";
    }[];
  }
): Promise<{ ok: boolean; shopifyProductId?: string; variantId?: string; inventoryItemId?: string; error?: string }> {
  const resp = await shopifyFetch(cfg, "/products.json", {
    method: "POST",
    body: JSON.stringify({
      product: {
        title: fields.title,
        body_html: fields.bodyHtml ?? "",
        vendor: fields.vendor ?? "",
        tags: fields.tags ?? "",
        status: fields.status ?? "active",
        variants: fields.variants.map((v) => ({
          price: v.price,
          sku: v.sku,
          inventory_management: v.inventoryManagement ?? "shopify",
          inventory_policy: v.inventoryPolicy ?? "deny",
        })),
      },
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    return { ok: false, error: err };
  }
  const data = await resp.json();
  const p = data.product;
  const v = p.variants?.[0];
  return {
    ok: true,
    shopifyProductId: String(p.id),
    variantId: v ? String(v.id) : undefined,
    inventoryItemId: v ? String(v.inventory_item_id) : undefined,
  };
}

/**
 * Get current inventory levels for a list of inventory item IDs at a location.
 * Returns map: inventoryItemId → available
 */
export async function getInventoryLevels(
  cfg: ShopifyConfig,
  inventoryItemIds: string[],
  locationId: string
): Promise<Record<string, number>> {
  if (inventoryItemIds.length === 0) return {};
  const map: Record<string, number> = {};
  // Shopify allows up to 50 IDs per request
  for (let i = 0; i < inventoryItemIds.length; i += 50) {
    const chunk = inventoryItemIds.slice(i, i + 50);
    const resp = await shopifyFetch(
      cfg,
      `/inventory_levels.json?inventory_item_ids=${chunk.join(",")}&location_ids=${locationId}&limit=50`
    );
    if (!resp.ok) continue;
    const data = await resp.json();
    for (const level of data.inventory_levels ?? []) {
      map[String(level.inventory_item_id)] = Number(level.available ?? 0);
    }
  }
  return map;
}
