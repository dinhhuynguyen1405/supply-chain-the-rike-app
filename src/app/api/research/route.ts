import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const items = await prisma.purchaseResearch.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      prices: true,
      product: { select: { id: true, name: true, nameVi: true } },
    },
  });

  // Compute live price stats
  const result = items.map((item) => {
    const priceValues = item.prices.map((p) => p.priceVnd);
    const avgPriceVnd =
      priceValues.length > 0
        ? priceValues.reduce((a, b) => a + b, 0) / priceValues.length
        : null;
    const minPriceVnd =
      priceValues.length > 0 ? Math.min(...priceValues) : null;
    const maxPriceVnd =
      priceValues.length > 0 ? Math.max(...priceValues) : null;

    return { ...item, avgPriceVnd, minPriceVnd, maxPriceVnd };
  });

  return Response.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const item = await prisma.purchaseResearch.create({
    data: {
      productName: body.productName,
      productId: body.productId || null,
      unit: body.unit || "kg",
      targetPriceVnd: body.targetPriceVnd ? Number(body.targetPriceVnd) : null,
      targetQty: body.targetQty ? Number(body.targetQty) : null,
      priority: body.priority ? Number(body.priority) : 2,
      status: body.status || "researching",
      qualityNotes: body.qualityNotes || null,
      sourceNotes: body.sourceNotes || null,
      generalNotes: body.generalNotes || null,
    },
    include: {
      prices: true,
      product: { select: { id: true, name: true, nameVi: true } },
    },
  });

  return Response.json(item, { status: 201 });
}
