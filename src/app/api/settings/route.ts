import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const DEFAULTS: Record<string, string> = {
  usdToVnd: "25500",
};

export async function GET() {
  const rows = await prisma.setting.findMany();
  const settings: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) settings[r.key] = r.value;
  return Response.json(settings);
}

export async function PUT(req: NextRequest) {
  const body: Record<string, string> = await req.json();
  await Promise.all(
    Object.entries(body).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    )
  );
  return Response.json({ ok: true });
}
