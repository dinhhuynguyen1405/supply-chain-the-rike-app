/**
 * POST /api/sync/shopify/full-history
 * ─────────────────────────────────────────────────────────────────────────────
 * Kéo toàn bộ lịch sử đơn hàng Shopify từ đầu đến nay.
 *
 * - Dùng `created_at_min=2015-01-01` để bypass giới hạn 60 ngày mặc định
 * - Upsert tất cả ShopifyOrder (không tạo FulfillmentOrder — chỉ lấy data phân tích)
 * - Idempotent: chạy lại không bị duplicate
 *
 * Returns:
 *   { ok, total, created, updated, oldestOrder, newestOrder, pages }
 */

import { prisma } from "@/lib/prisma";

interface ShopifyLineItem {
  sku?: string;
  name?: string;
  quantity?: number;
  price?: string;
}

interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  line_items: ShopifyLineItem[];
  source_name: string;
  payment_gateway_names?: string[];
  created_at: string;
}

export async function POST() {
  // ── Load Shopify credentials ──────────────────────────────────────────────
  const settings = await prisma.setting.findMany();
  const cfg = settings.reduce((a, s) => ({ ...a, [s.key]: s.value }), {} as Record<string, string>);

  const domainRaw   = cfg.shopifyStoreDomain   || process.env.SHOPIFY_STORE_DOMAIN || "";
  const accessToken = cfg.shopifyAccessToken   || cfg.shopifyApiSecret || process.env.SHOPIFY_API_SECRET || "";
  const domain      = domainRaw.replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!domain || !accessToken) {
    return Response.json({ error: "Chưa cấu hình Shopify. Vào Settings → Kết nối Shopify." }, { status: 400 });
  }

  // ── Fetch ALL orders via since_id pagination ─────────────────────────────
  // Shopify cursor pagination breaks when combined with `order=` param.
  // since_id approach: fetch oldest-first using since_id to walk the full history.
  // `created_at_min=2015-01-01` bypasses Shopify's default 60-day window.
  const API_BASE = `https://${domain}/admin/api/2024-01/orders.json`;
  const HEADERS  = { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" };

  let allOrders: ShopifyOrder[] = [];
  let sinceId = 0;
  let pages = 0;
  const MAX_PAGES = 200; // safety cap (200 × 250 = 50,000 orders)

  while (pages < MAX_PAGES) {
    const params = new URLSearchParams({
      status:          "any",
      limit:           "250",
      order:           "id asc",
      since_id:        String(sinceId),
      created_at_min:  "2015-01-01T00:00:00Z",
    });

    const shopifyRes: Response = await fetch(`${API_BASE}?${params}`, { headers: HEADERS });

    if (!shopifyRes.ok) {
      const err = await shopifyRes.text();
      return Response.json({ error: `Shopify API lỗi: ${err}` }, { status: 502 });
    }

    const pageData = await shopifyRes.json() as { orders: ShopifyOrder[] };
    const batch = pageData.orders ?? [];
    if (batch.length === 0) break;   // no more orders

    allOrders = allOrders.concat(batch);
    sinceId = batch[batch.length - 1].id; // advance cursor
    pages++;

    if (batch.length < 250) break;   // last page
  }

  if (allOrders.length === 0) {
    return Response.json({ ok: true, total: 0, created: 0, updated: 0, pages });
  }

  // ── Upsert into DB ────────────────────────────────────────────────────────
  let created = 0;
  let updated = 0;

  // Batch upsert: check existing in bulk to avoid N+1
  const shopifyIds = allOrders.map(o => o.id.toString());
  const existingSet = new Set(
    (await prisma.shopifyOrder.findMany({
      where: { shopifyId: { in: shopifyIds } },
      select: { shopifyId: true },
    })).map(r => r.shopifyId)
  );

  // Process in batches of 100 to avoid overwhelming the DB
  const BATCH = 100;
  for (let i = 0; i < allOrders.length; i += BATCH) {
    const batch = allOrders.slice(i, i + BATCH);

    await Promise.all(batch.map(async (order) => {
      const orderId    = order.id.toString();
      const sourceName = order.source_name ?? "";
      const gateway   = order.payment_gateway_names?.[0] ?? "";

      if (existingSet.has(orderId)) {
        // Update mutable fields (financial/fulfillment status may change)
        await prisma.shopifyOrder.update({
          where: { shopifyId: orderId },
          data: {
            financialStatus:    order.financial_status,
            fulfillmentStatus:  order.fulfillment_status ?? null,
            totalPriceUsd:      parseFloat(order.total_price),
            sourceName,
            paymentGateway:     gateway,
            syncedAt:           new Date(),
          },
        });
        updated++;
      } else {
        // Insert new — keep lineItemsJson for analytics
        await prisma.shopifyOrder.create({
          data: {
            shopifyId:          orderId,
            orderName:          order.name,
            email:              order.email ?? "",
            financialStatus:    order.financial_status,
            fulfillmentStatus:  order.fulfillment_status ?? null,
            totalPriceUsd:      parseFloat(order.total_price),
            lineItemsJson:      JSON.stringify(order.line_items),
            sourceName,
            paymentGateway:     gateway,
            createdAtShopify:   new Date(order.created_at),
          },
        });
        created++;
      }
    }));
  }

  const dates = allOrders.map(o => new Date(o.created_at).getTime()).sort((a, b) => a - b);
  const oldestOrder = new Date(dates[0]).toISOString();
  const newestOrder = new Date(dates[dates.length - 1]).toISOString();

  return Response.json({
    ok: true,
    total:  allOrders.length,
    created,
    updated,
    oldestOrder,
    newestOrder,
    pages,
  });
}
