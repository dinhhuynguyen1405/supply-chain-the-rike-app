/**
 * /api/shopify/products/[id]
 * ─────────────────────────────────────────────────────────────────────────────
 * Cập nhật thông tin listing sản phẩm trên Shopify từ trong app.
 *
 * PATCH → Cập nhật title, description, price, status, sku, tags, vendor
 *         [id] = Shopify product ID
 */

import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import {
  getShopifyConfig,
  updateProduct,
  updateVariant,
  setInventory,
  getLocationId,
} from "@/lib/shopify";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: shopifyProductId } = await params;
  const body = await req.json();

  const cfg = await getShopifyConfig();
  if (!cfg) {
    return Response.json({ error: "Chưa cấu hình Shopify" }, { status: 400 });
  }

  const results: Record<string, unknown> = {};

  // ── 1. Cập nhật thông tin sản phẩm ─────────────────────────────────────────
  if (body.title || body.bodyHtml !== undefined || body.status || body.tags !== undefined || body.vendor) {
    const r = await updateProduct(cfg, shopifyProductId, {
      ...(body.title && { title: body.title }),
      ...(body.bodyHtml !== undefined && { bodyHtml: body.bodyHtml }),
      ...(body.status && { status: body.status }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(body.vendor && { vendor: body.vendor }),
    });
    results.product = r.ok ? "updated" : r.error;
  }

  // ── 2. Cập nhật variant (giá, SKU, barcode) ─────────────────────────────────
  if (body.variantId && (body.price !== undefined || body.sku || body.barcode || body.compareAtPrice !== undefined)) {
    const r = await updateVariant(cfg, shopifyProductId, body.variantId, {
      ...(body.price !== undefined && { price: String(body.price) }),
      ...(body.compareAtPrice !== undefined && { compareAtPrice: String(body.compareAtPrice) }),
      ...(body.sku && { sku: body.sku }),
      ...(body.barcode !== undefined && { barcode: body.barcode }),
    });
    results.variant = r.ok ? "updated" : r.error;

    // Nếu SKU hoặc giá thay đổi → cập nhật local DB
    if (r.ok && body.localProductId) {
      const localData: Record<string, unknown> = {};
      if (body.sku) localData.skuShopify = body.sku;
      if (body.price !== undefined) localData.priceUsd = Number(body.price);
      if (Object.keys(localData).length > 0) {
        await prisma.product.update({ where: { id: body.localProductId }, data: localData });
      }
    }
  }

  // ── 3. Cập nhật inventory trực tiếp ─────────────────────────────────────────
  if (body.inventoryItemId && body.inventoryQty !== undefined) {
    const locationId = await getLocationId(cfg);
    if (locationId) {
      const ok = await setInventory(cfg, body.inventoryItemId, locationId, Number(body.inventoryQty));
      results.inventory = ok ? "updated" : "error";

      // Nếu set inventory thủ công → cập nhật nhungQty trong local DB để consistent
      // (chỉ khi biết localProductId và destinationWarehouse)
      if (ok && body.localProductId && body.inventoryBreakdown) {
        const { nhungQty, brosQty } = body.inventoryBreakdown;
        if (nhungQty !== undefined) {
          await prisma.product.update({
            where: { id: body.localProductId },
            data: { nhungQty: Math.max(0, Number(nhungQty)) },
          });
        }
        if (brosQty !== undefined && body.skuBros) {
          await prisma.warehouseStock.updateMany({
            where: { warehouse: "bros", sku: body.skuBros },
            data: { inStock: Math.max(0, Number(brosQty)) },
          });
        }
        triggerSheetSync("nhung");
      }
    }
  }

  return Response.json({ ok: true, results });
}
