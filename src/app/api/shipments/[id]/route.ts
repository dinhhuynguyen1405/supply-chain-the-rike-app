import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const batch = await prisma.shipmentBatch.update({
    where: { id },
    data: {
      ...(body.status !== undefined && { status: body.status }),
      ...(body.carrier !== undefined && { carrier: body.carrier || null }),
      ...(body.trackingCode !== undefined && { trackingCode: body.trackingCode || null }),
      ...(body.packedDate !== undefined && { packedDate: body.packedDate ? new Date(body.packedDate) : null }),
      ...(body.departedVnDate !== undefined && { departedVnDate: body.departedVnDate ? new Date(body.departedVnDate) : null }),
      ...(body.arrivedUsDate !== undefined && { arrivedUsDate: body.arrivedUsDate ? new Date(body.arrivedUsDate) : null }),
      ...(body.receivedByTdDate !== undefined && { receivedByTdDate: body.receivedByTdDate ? new Date(body.receivedByTdDate) : null }),
      ...(body.tdSheetUpdated !== undefined && { tdSheetUpdated: body.tdSheetUpdated }),
      ...(body.notes !== undefined && { notes: body.notes || null }),
      ...(body.shippingCostVnd !== undefined && { shippingCostVnd: body.shippingCostVnd ? Number(body.shippingCostVnd) : null }),
      ...(body.totalWeightKg !== undefined && { totalWeightKg: body.totalWeightKg ? Number(body.totalWeightKg) : null }),
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
  return Response.json(batch);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.shipmentBatch.delete({ where: { id } });
  return Response.json({ ok: true });
}
