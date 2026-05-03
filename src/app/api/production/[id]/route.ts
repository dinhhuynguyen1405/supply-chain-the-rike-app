import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";
import {
  getShopifyConfig,
  getVariantMap,
  getLocationId,
  pushTotalInventory,
} from "@/lib/shopify";

const include = {
  purchaseOrder: { include: { supplier: true } },
  items: { include: { product: true, purchaseItem: true } },
  costs: { orderBy: { createdAt: "asc" as const } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const order = await prisma.productionOrder.findUnique({ where: { id }, include });
  if (!order) return new Response("Not found", { status: 404 });
  return Response.json(order);
}

/**
 * PATCH /api/production/[id]
 * Body có thể chứa:
 *   status, notes
 *   items: [{ id, actualQty, wasteNote, gramsPerPack, piecesPerUnit, piecesPerPack, plannedQty }]
 *   addCost: { type, description, amountVnd, note }   — thêm 1 dòng chi phí
 *   deleteCostId: string                               — xóa 1 dòng chi phí
 *   updateCost: { id, amountVnd, description, note }   — sửa 1 dòng chi phí
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Thêm cost mới
  if (body.addCost) {
    const c = body.addCost;
    await prisma.productionCost.create({
      data: {
        productionOrderId: id,
        type:        c.type || "other",
        description: c.description,
        amountVnd:   Number(c.amountVnd),
        note:        c.note || null,
        purchaseOrderId: c.purchaseOrderId || null,
      },
    });
    const order = await prisma.productionOrder.findUnique({ where: { id }, include });
    return Response.json(order);
  }

  // Xóa cost
  if (body.deleteCostId) {
    await prisma.productionCost.delete({ where: { id: body.deleteCostId } });
    const order = await prisma.productionOrder.findUnique({ where: { id }, include });
    return Response.json(order);
  }

  // Sửa cost
  if (body.updateCost) {
    const c = body.updateCost;
    await prisma.productionCost.update({
      where: { id: c.id },
      data: {
        description: c.description,
        amountVnd:   Number(c.amountVnd),
        note:        c.note || null,
      },
    });
    const order = await prisma.productionOrder.findUnique({ where: { id }, include });
    return Response.json(order);
  }

  // Update order fields
  const data: Record<string, unknown> = {};
  if ("status" in body) {
    data.status = body.status;
    if (body.status === "in_production") data.startedAt = new Date();
    if (body.status === "done") data.completedAt = new Date();
  }
  if ("notes" in body) data.notes = body.notes || null;

  // Update items: actualQty, wasteNote, packing config, plannedQty
  if (body.items && Array.isArray(body.items)) {
    await Promise.all(
      (body.items as {
        id: string;
        actualQty: number | null;
        wasteNote?: string;
        gramsPerPack?: number | null;
        piecesPerUnit?: number | null;
        piecesPerPack?: number | null;
        plannedQty?: number;
      }[]).map((item) =>
        prisma.productionItem.update({
          where: { id: item.id },
          data: {
            actualQty:     item.actualQty    != null ? Number(item.actualQty)    : null,
            wasteNote:     item.wasteNote    || null,
            gramsPerPack:  item.gramsPerPack  != null ? Number(item.gramsPerPack)  : null,
            piecesPerUnit: item.piecesPerUnit != null ? Number(item.piecesPerUnit) : null,
            piecesPerPack: item.piecesPerPack != null ? Number(item.piecesPerPack) : null,
            ...(item.plannedQty != null && { plannedQty: Number(item.plannedQty) }),
          },
        })
      )
    );
  }

  const order = await prisma.productionOrder.update({ where: { id }, data, include });

  if (body.status === "done") {
    triggerSheetSync("inventory");
    triggerSheetSync("production");

    // ── Option: cộng thẳng nhungQty khi sản xuất xong ─────────────────────
    // Dùng khi hàng KHÔNG qua ship quốc tế (ví dụ: hàng gia công tại Mỹ,
    // hoặc hàng VN đã ở Kho Nhung rồi mới sản xuất)
    // Body: { status: "done", addToNhung: true }
    if (body.addToNhung) {
      const productIds: string[] = [];
      for (const item of order.items) {
        const qty = item.actualQty ?? item.plannedQty;
        if (!item.productId || qty <= 0) continue;
        await prisma.product.update({
          where: { id: item.productId },
          data: { nhungQty: { increment: qty } },
        });
        productIds.push(item.productId);
      }

      // Push Shopify cho các sản phẩm bị ảnh hưởng
      if (productIds.length > 0) {
        (async () => {
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
                (p.skuAmz ? brosMap[p.skuAmz] : null) ?? brosMap[p.skuShopify] ?? 0;
              const total = Math.max(0, Math.round(p.nhungQty + brosQty));
              await pushTotalInventory(cfg, variantMap, locationId, p.skuShopify, total);
            }
            triggerSheetSync("nhung");
          } catch (e) {
            console.warn("[production done] Shopify push error:", e);
          }
        })();
      }
    }
  }

  return Response.json(order);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.productionOrder.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
