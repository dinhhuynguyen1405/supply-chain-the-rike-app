import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";
import {
  getShopifyConfig,
  getVariantMap,
  getLocationId,
  pushTotalInventory,
} from "@/lib/shopify";

// ─── Helper: tính số gói bán từ nguyên liệu thô ──────────────────────────────

function toSellingUnits(
  quantity: number,
  unit: string,
  gramsPerUnit: number | null,
  piecesPerUnit: number | null,
  piecesPerPack: number | null
): number {
  if (gramsPerUnit && (unit === "kg" || unit === "g")) {
    const grams = unit === "kg" ? quantity * 1000 : quantity;
    return Math.floor(grams / gramsPerUnit);
  }
  if (piecesPerUnit && piecesPerPack && piecesPerPack > 0) {
    return Math.floor((quantity * piecesPerUnit) / piecesPerPack);
  }
  return Math.round(quantity);
}

// ─── Core: auto-cộng inventory khi lô hàng đến nơi ──────────────────────────
//
// Logic:
// 1. Lấy tất cả PurchaseOrder trong lô
// 2. Với mỗi PurchaseOrder:
//    a. Nếu có ProductionOrder → dùng ProductionItem.actualQty (đã đóng gói xong)
//    b. Nếu không có → tính toán từ PurchaseItem (hàng sỉ, đóng gói theo công thức)
// 3. destinationWarehouse = "nhung" → cộng Product.nhungQty
//    destinationWarehouse = "bros" → cộng WarehouseStock.inStock (warehouse=bros)
//    destinationWarehouse = "mixed" → skip auto (cập nhật thủ công)
// 4. Push tổng (nhungQty + brosQty) lên Shopify

interface InventoryDelta {
  productId: string;
  skuShopify: string | null;
  skuAmz: string | null;
  delta: number;
}

async function autoUpdateInventoryOnArrival(batchId: string, destinationWarehouse: string) {
  if (destinationWarehouse === "mixed") {
    console.log(`[shipment] Batch ${batchId} is mixed → skipping auto-inventory`);
    return;
  }

  // Lấy toàn bộ đơn mua trong lô (kèm sản phẩm + sản xuất)
  const batchOrders = await prisma.shipmentBatchOrder.findMany({
    where: { shipmentBatchId: batchId },
    include: {
      purchaseOrder: {
        include: {
          items: {
            include: {
              product: true,
              productionItems: true,
            },
          },
          productionOrder: {
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
      },
    },
  });

  // Thu thập delta cho từng sản phẩm
  const deltaMap: Record<string, InventoryDelta> = {};

  for (const bo of batchOrders) {
    const po = bo.purchaseOrder;

    if (po.productionOrder) {
      // ── Luồng B: Sản xuất tại Kho Huy ────────────────────────────────────
      for (const pi of po.productionOrder.items) {
        const qty = pi.actualQty ?? pi.plannedQty; // ưu tiên actualQty
        if (!pi.productId || qty <= 0) continue;
        const key = pi.productId;
        if (!deltaMap[key]) {
          deltaMap[key] = {
            productId: pi.productId,
            skuShopify: pi.product.skuShopify,
            skuAmz: pi.product.skuAmz,
            delta: 0,
          };
        }
        deltaMap[key].delta += qty;
      }
    } else {
      // ── Luồng A: Hàng sỉ (không qua sản xuất) ────────────────────────────
      for (const item of po.items) {
        if (!item.productId || !item.product) continue;
        const p = item.product;
        const sellingQty = toSellingUnits(
          item.quantity,
          p.unit,
          p.gramsPerUnit,
          p.piecesPerUnit,
          p.piecesPerPack
        );
        if (sellingQty <= 0) continue;
        const key = item.productId;
        if (!deltaMap[key]) {
          deltaMap[key] = {
            productId: item.productId,
            skuShopify: p.skuShopify,
            skuAmz: p.skuAmz,
            delta: 0,
          };
        }
        deltaMap[key].delta += sellingQty;
      }
    }
  }

  const deltas = Object.values(deltaMap).filter((d) => d.delta > 0);
  if (deltas.length === 0) return;

  // ── Cập nhật DB ────────────────────────────────────────────────────────────
  if (destinationWarehouse === "nhung") {
    // Cộng vào Product.nhungQty
    await Promise.all(
      deltas.map((d) =>
        prisma.product.update({
          where: { id: d.productId },
          data: { nhungQty: { increment: d.delta } },
        })
      )
    );
    triggerSheetSync("nhung");
  } else if (destinationWarehouse === "bros") {
    // Cộng vào WarehouseStock (warehouse=bros)
    // Nếu chưa có record → tạo mới
    for (const d of deltas) {
      const sku = d.skuAmz || d.skuShopify;
      if (!sku) continue;
      const existing = await prisma.warehouseStock.findUnique({
        where: { sku_warehouse: { sku, warehouse: "bros" } },
      });
      if (existing) {
        await prisma.warehouseStock.update({
          where: { sku_warehouse: { sku, warehouse: "bros" } },
          data: {
            inStock: { increment: d.delta },
            received: { increment: d.delta },
          },
        });
      } else {
        // Tạo record mới cho SKU này tại Bros
        const product = await prisma.product.findUnique({
          where: { id: d.productId },
          select: { name: true },
        });
        await prisma.warehouseStock.create({
          data: {
            sku,
            warehouse: "bros",
            description: product?.name ?? sku,
            inStock: d.delta,
            received: d.delta,
          },
        });
      }
    }
    triggerSheetSync("nhung");
  }

  // ── Push Shopify: nhungQty + brosQty mới ──────────────────────────────────
  try {
    const cfg = await getShopifyConfig();
    if (!cfg) return;
    const productIds = deltas.map((d) => d.productId);
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
  } catch (e) {
    console.warn("[shipment] Shopify push error:", e);
  }
}

// ─── PATCH /api/shipments/[id] ────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const current = await prisma.shipmentBatch.findUnique({ where: { id } });
  if (!current) return Response.json({ error: "Not found" }, { status: 404 });

  const newStatus: string | undefined = body.status;
  const justDone =
    newStatus === "done" && current.status !== "done" && !current.inventoryUpdated;

  const batch = await prisma.shipmentBatch.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.carrier !== undefined && { carrier: body.carrier || null }),
      ...(body.trackingCode !== undefined && { trackingCode: body.trackingCode || null }),
      ...(body.packedDate !== undefined && {
        packedDate: body.packedDate ? new Date(body.packedDate) : null,
      }),
      ...(body.departedVnDate !== undefined && {
        departedVnDate: body.departedVnDate ? new Date(body.departedVnDate) : null,
      }),
      ...(body.arrivedUsDate !== undefined && {
        arrivedUsDate: body.arrivedUsDate ? new Date(body.arrivedUsDate) : null,
      }),
      ...(body.receivedByTdDate !== undefined && {
        receivedByTdDate: body.receivedByTdDate ? new Date(body.receivedByTdDate) : null,
      }),
      ...(body.tdSheetUpdated !== undefined && { tdSheetUpdated: body.tdSheetUpdated }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(body.shippingCostVnd !== undefined && {
        shippingCostVnd: body.shippingCostVnd ? Number(body.shippingCostVnd) : null,
      }),
      ...(body.totalWeightKg !== undefined && {
        totalWeightKg: body.totalWeightKg ? Number(body.totalWeightKg) : null,
      }),
      ...(body.destinationWarehouse !== undefined && {
        destinationWarehouse: body.destinationWarehouse,
      }),
      ...(body.autoUpdateInventory !== undefined && {
        autoUpdateInventory: body.autoUpdateInventory,
      }),
      // Đánh dấu đã tự động update inventory
      ...(justDone && current.autoUpdateInventory && { inventoryUpdated: true }),
    },
    include: {
      orders: {
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
              items: { include: { product: true } },
            },
          },
        },
      },
    },
  });

  triggerSheetSync("inbound");

  // Auto-update inventory khi lô vừa chuyển sang "done"
  if (justDone && current.autoUpdateInventory) {
    // Fire-and-forget — không chờ để tránh timeout
    autoUpdateInventoryOnArrival(id, batch.destinationWarehouse).catch((e) =>
      console.error("[shipment] autoUpdateInventory error:", e)
    );
  }

  return Response.json(batch);
}

// ─── DELETE /api/shipments/[id] ───────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.shipmentBatch.delete({ where: { id } });
  return Response.json({ ok: true });
}
