import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const now = new Date();

  // ── Warehouse notification / shipping timestamps ──────────────────────────
  const warehouseData: Record<string, unknown> = {};

  if (body.action === "nhung_notify") {
    warehouseData.nhungNotifiedAt = now;
    warehouseData.status = "notified";
  }
  if (body.action === "nhung_shipped") {
    warehouseData.nhungShippedAt = now;
    if (body.trackingCode) warehouseData.nhungTrackingCode = body.trackingCode;
    // Deduct nhungQty khi Nhung xác nhận đã ship
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
        }
      }
      triggerSheetSync("nhung");
    }
  }
  if (body.action === "bros_notify") {
    warehouseData.brosNotifiedAt = now;
    warehouseData.status = "notified";
  }
  if (body.action === "bros_shipped") {
    warehouseData.brosShippedAt = now;
    if (body.trackingCode) warehouseData.brosTrackingCode = body.trackingCode;
  }

  // Auto-set status = "shipped" khi cả 2 kho đã ship (hoặc order chỉ 1 kho)
  if (body.action === "nhung_shipped" || body.action === "bros_shipped") {
    const current = await prisma.fulfillmentOrder.findUnique({ where: { id } });
    if (current) {
      const ws = current.warehouseSource;
      const nhungDone = body.action === "nhung_shipped" || !!current.nhungShippedAt;
      const brosDone = body.action === "bros_shipped" || !!current.brosShippedAt;
      if (
        ws === "nhung" && nhungDone ||
        ws === "bros" && brosDone ||
        ws === "mixed" && nhungDone && brosDone
      ) {
        warehouseData.status = "shipped";
        warehouseData.shippedAt = now;
      }
    }
  }

  // ── Done action ───────────────────────────────────────────────────────────
  if (body.action === "done") {
    warehouseData.status = "done";
  }

  if (body.action === "cancelled") {
    warehouseData.status = "cancelled";
  }

  const updated = await prisma.fulfillmentOrder.update({
    where: { id },
    data: {
      ...warehouseData,
      // Legacy fields
      ...(body.status !== undefined && !body.action && { status: body.status }),
      ...(body.sentToTdAt !== undefined && { sentToTdAt: body.sentToTdAt ? new Date(body.sentToTdAt) : null }),
      ...(body.packedAt !== undefined && { packedAt: body.packedAt ? new Date(body.packedAt) : null }),
      ...(body.shippedAt !== undefined && !body.action && { shippedAt: body.shippedAt ? new Date(body.shippedAt) : null }),
      ...(body.trackingCode !== undefined && !body.action && { trackingCode: body.trackingCode || null }),
      ...(body.tdSheetSynced !== undefined && { tdSheetSynced: body.tdSheetSynced }),
      ...(body.noteSentToTd !== undefined && { noteSentToTd: body.noteSentToTd || null }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
    },
    include: { items: { include: { product: true } } },
  });

  triggerSheetSync("fbm");
  triggerSheetSync("nhung_orders");
  return Response.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.fulfillmentOrder.delete({ where: { id } });
  return Response.json({ ok: true });
}
