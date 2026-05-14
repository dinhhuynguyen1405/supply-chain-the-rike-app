/**
 * GET /api/search?q=...
 * Full-text search across products, purchase orders, and suppliers
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q || q.length < 2) return Response.json([]);

  const [products, purchases, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { nameVi: { contains: q, mode: "insensitive" } },
          { skuShopify: { contains: q, mode: "insensitive" } },
          { skuAmz: { contains: q, mode: "insensitive" } },
          { skuTiktok: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, nameVi: true, skuShopify: true, category: true },
      take: 8,
    }),

    prisma.purchaseOrder.findMany({
      where: {
        OR: [
          { code: { contains: q, mode: "insensitive" } },
          { supplier: { name: { contains: q, mode: "insensitive" } } },
          { shippingCode: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        code: true,
        status: true,
        totalVnd: true,
        supplier: { select: { name: true } },
      },
      orderBy: { orderDate: "desc" },
      take: 6,
    }),

    prisma.supplier.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
          { notes: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, location: true },
      take: 5,
    }),
  ]);

  const results = [
    ...products.map((p) => ({
      id: p.id,
      type: "product" as const,
      title: p.nameVi ?? p.name,
      subtitle: [p.skuShopify, p.category].filter(Boolean).join(" · "),
      href: `/products/${p.id}`,
    })),
    ...purchases.map((p) => ({
      id: p.id,
      type: "purchase" as const,
      title: p.code,
      subtitle: `${p.supplier.name} · ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(p.totalVnd)}`,
      href: `/purchases/${p.id}`,
    })),
    ...suppliers.map((s) => ({
      id: s.id,
      type: "supplier" as const,
      title: s.name,
      subtitle: s.location ?? undefined,
      href: `/suppliers`,
    })),
  ];

  return Response.json(results);
}
