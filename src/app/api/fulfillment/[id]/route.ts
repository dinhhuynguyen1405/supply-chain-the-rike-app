import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";
import {
  getShopifyConfig,
  getVariantMap,
  getLocationId,
  pushTotalInventory,
} from "@/lib/shopify";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sau khi nhungQty hoặc brosQty thay đổi, push tổng inventory lên Shopify
 * cho tất cả sản phẩm bị ảnh hưởng (theo danh sách productIds).
 */
async function pushInventoryForProducts(productIds: string[]) {
  if (productIds.length === 0) return;
  try {
    const cfg = await getShopifyConfig();
    if (!cfg) return;
    const [variantMap, locationId, products, brosStocks] = await Promise.all([
      getVariantMap(cfg),
      getLocationId(cfg),
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, skuShopify: true, skuAmz: true, nhungQty: true },
      }),
      prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
    ]);
    if (!locationId) return;

    const brosMap: Record<string, number> = {};
    for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

    for (const p of products) {
      if (!p.skuShopify) continue;
      const brosQty =
        (p.skuAmz ? brosMap[p.skuAmz] : null) ??
        brosMap[p.skuShopify] ??
        0;
      const total = Math.max(0, Math.round(p.nhungQty + brosQty));
      await pushTotalInventory(cfg, variantMap, locationId, p.skuShopify, total);
    }
  } catch (e) {
    console.warn("[fulfillment] Shopify push error:", e);
  }
}

// ─── PATCH /api/fulfillment/[id] ─────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const now = new Date();
  const warehouseData: Record<string, unknown> = {};
  const inventoryProductIds: string[] = []; // sản phẩm cần push Shopify sau

  // ── Kho Nhung ────────────────────────────────────────────────────────────────
  if (body.action === "nhung_notify") {
    warehouseData.nhungNotifiedAt = now;
    warehouseData.status = "notified";
  }

  if (body.action === "nhung_shipped") {
    warehouseData.nhungShippedAt = now;
    if (body.trackingCode) warehouseData.nhungTrackingCode = body.trackingCode;

    // Trừ nhungQty khi Nhung xác nhận đã ship
    const order = await prisma.fulfillmentOrder.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (order) {
      for (const item of order.items) {
        if (item.warehouseSource === "nhung" && item.productId) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { nhungQty: { decrement: item.quantity } },
          });
          inventoryProductIds.push(item.productId);
        }
      }
      triggerSheetSync("nhung");
    }
  }

  // ── Kho Bros ─────────────────────────────────────────────────────────────────
  if (body.action === "bros_notify") {
    warehouseData.brosNotifiedAt = now;
    warehouseData.status = "notified";
  }

  if (body.action === "bros_shipped") {
    warehouseData.brosShippedAt = now;
    if (body.trackingCode) warehouseData.brosTrackingCode = body.trackingCode;

    // Trừ WarehouseStock.inStock khi Bros xác nhận đã ship
    const order = await prisma.fulfillmentOrder.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (order) {
      for (const item of order.items) {
        if (item.warehouseSource === "bros" && item.productId && item.product) {
          // Bros dùng skuAmz trước, fallback skuShopify
          const sku = item.product.skuAmz || item.product.skuShopify;
          if (sku) {
            // Trừ tồn kho kho Bros trong DB app (không động vào sheet Bros)
            await prisma.warehouseStock.updateMany({
              where: { warehouse: "bros", sku },
              data: { inStock: { decrement: item.quantity } },
            });
          }
          inventoryProductIds.push(item.productId);
        }
      }
      triggerSheetSync("nhung"); // cập nhật tab Kho Nhung (tổng = nhung + bros)
    }
  }

  // ── Auto-set status = "shipped" khi đủ kho đã ship ──────────────────────────
  if (body.action === "nhung_shipped" || body.action === "bros_shipped") {
    const current = await prisma.fulfillmentOrder.findUnique({ where: { id } });
    if (current) {
      const ws = current.warehouseSource;
      const nhungDone =
        body.action === "nhung_shipped" || !!current.nhungShippedAt;
      const brosDone =
        body.action === "bros_shipped" || !!current.brosShippedAt;
      if (
        (ws === "nhung" && nhungDone) ||
        (ws === "bros" && brosDone) ||
        (ws === "mixed" && nhungDone && brosDone)
      ) {
        warehouseData.status = "shipped";
        warehouseData.shippedAt = now;
      }
    }
  }

  // ── Done / Cancelled ─────────────────────────────────────────────────────────
  if (body.action === "done") warehouseData.status = "done";
  if (body.action === "cancelled") warehouseData.status = "cancelled";

  // ── Persist ──────────────────────────────────────────────────────────────────
  const updated = await prisma.fulfillmentOrder.update({
    where: { id },
    data: {
      ...warehouseData,
      // Legacy / direct field updates (không kèm action)
      ...(body.status !== undefined && !body.action && { status: body.status }),
      ...(body.sentToTdAt !== undefined && {
        sentToTdAt: body.sentToTdAt ? new Date(body.sentToTdAt) : null,
      }),
      ...(body.packedAt !== undefined && {
        packedAt: body.packedAt ? new Date(body.packedAt) : null,
      }),
      ...(body.shippedAt !== undefined &&
        !body.action && {
          shippedAt: body.shippedAt ? new Date(body.shippedAt) : null,
        }),
      ...(body.trackingCode !== undefined &&
        !body.action && { trackingCode: body.trackingCode || null }),
      ...(body.tdSheetSynced !== undefined && {
        tdSheetSynced: body.tdSheetSynced,
      }),
      ...(body.noteSentToTd !== undefined && {
        noteSentToTd: body.noteSentToTd || null,
      }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
    },
    include: { items: { include: { product: true } } },
  });

  // Push Shopify inventory sau khi đã lưu DB (fire-and-forget)
  if (inventoryProductIds.length > 0) {
    pushInventoryForProducts([...new Set(inventoryProductIds)]);
  }

  triggerSheetSync("fbm");
  triggerSheetSync("nhung_orders");
  return Response.json(updated);
}

// ─── DELETE /api/fulfillment/[id] ────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.fulfillmentOrder.delete({ where: { id } });
  return Response.json({ ok: true });
}
