import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET() {
  const costs = await prisma.operatingCost.findMany({
    orderBy: { date: "desc" },
  });

  const rateSetting = await prisma.setting.findUnique({ where: { key: "usdToVnd" } });
  const usdToVnd = parseFloat(rateSetting?.value ?? "25500") || 25500;

  const totalUsd = costs.reduce((s, c) => s + (c.amountUsd ?? 0), 0);
  const totalVnd = costs.reduce((s, c) => s + (c.amountVnd ?? 0), 0);
  const totalVndEquiv = totalUsd * usdToVnd + totalVnd;

  // Group by type
  const byType: Record<string, number> = {};
  for (const c of costs) {
    const vndEquiv = (c.amountUsd ?? 0) * usdToVnd + (c.amountVnd ?? 0);
    byType[c.type] = (byType[c.type] ?? 0) + vndEquiv;
  }

  return Response.json({ costs, totalUsd, totalVnd, totalVndEquiv, byType, usdToVnd });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cost = await prisma.operatingCost.create({
    data: {
      type: body.type,
      channel: body.channel || null,
      amountUsd: body.amountUsd ? Number(body.amountUsd) : null,
      amountVnd: body.amountVnd ? Number(body.amountVnd) : null,
      date: new Date(body.date),
      description: body.description,
      notes: body.notes || null,
    },
  });
  return Response.json(cost, { status: 201 });
}
