import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { generateShipmentCode } from "@/lib/utils";
import { triggerSheetSync } from "@/lib/sync-trigger";

export async function GET() {
  const batches = await prisma.shipmentBatch.findMany({
    orderBy: { createdAt: "desc" },
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
  return Response.json(batches);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const batch = await prisma.shipmentBatch.create({
    data: {
      code: generateShipmentCode(),
      description: body.description || null,
      carrier: body.carrier || null,
      trackingCode: body.trackingCode || null,
      packedDate: body.packedDate ? new Date(body.packedDate) : null,
      departedVnDate: body.departedVnDate ? new Date(body.departedVnDate) : null,
      totalWeightKg: body.totalWeightKg ? Number(body.totalWeightKg) : null,
      shippingCostVnd: body.shippingCostVnd ? Number(body.shippingCostVnd) : null,
      notes: body.notes || null,
      orders: {
        create: (body.purchaseOrderIds as string[]).map((purchaseOrderId) => ({
          purchaseOrderId,
        })),
      },
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
  return Response.json(batch, { status: 201 });
}
