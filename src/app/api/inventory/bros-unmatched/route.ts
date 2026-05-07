/**
 * GET /api/inventory/bros-unmatched
 * ─────────────────────────────────────────────────────────────────────────────
 * Trả về danh sách hàng tại Kho Bros mà CHƯA KHỚP với bất kỳ sản phẩm nào
 * trong DB (dựa trên skuShopify, skuAmz, skuBros).
 *
 * Cũng trả về gợi ý sản phẩm tương tự (fuzzy match theo description/name)
 * để user có thể tự link hoặc tạo mới.
 */

import { prisma } from "@/lib/prisma";

export interface UnmatchedBrosItem {
  sku: string;
  description: string | null;
  inStock: number;
  unit: string | null;
  /** Gợi ý sản phẩm gần nhất (top 3, sắp theo độ tương đồng) */
  suggestions: { id: string; name: string; nameVi: string | null; skuShopify: string | null }[];
}

export async function GET() {
  const [brosStocks, products] = await Promise.all([
    prisma.warehouseStock.findMany({ where: { warehouse: "bros", inStock: { gt: 0 } } }),
    prisma.product.findMany({
      select: { id: true, name: true, nameVi: true, skuShopify: true, skuAmz: true, skuBros: true },
    }),
  ]);

  // Build set of all product SKUs
  const matchedSkus = new Set<string>();
  for (const p of products) {
    if (p.skuShopify) matchedSkus.add(p.skuShopify);
    if (p.skuAmz) matchedSkus.add(p.skuAmz);
    if (p.skuBros) matchedSkus.add(p.skuBros);
  }

  // Unmatched Bros items
  const unmatched = brosStocks.filter((s) => !matchedSkus.has(s.sku));

  // Simple fuzzy match: check if any word in bros description appears in product name/nameVi
  function suggest(description: string | null) {
    if (!description) return [];
    const words = description.toLowerCase().split(/[\s,_/-]+/).filter((w) => w.length > 2);
    const scored = products.map((p) => {
      const haystack = `${p.name} ${p.nameVi ?? ""}`.toLowerCase();
      const score = words.filter((w) => haystack.includes(w)).length;
      return { ...p, score };
    });
    return scored
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ id, name, nameVi, skuShopify }) => ({ id, name, nameVi, skuShopify }));
  }

  const result: UnmatchedBrosItem[] = unmatched.map((s) => ({
    sku: s.sku,
    description: s.description,
    inStock: s.inStock,
    unit: s.unit,
    suggestions: suggest(s.description),
  }));

  return Response.json(result);
}

/**
 * POST /api/inventory/bros-unmatched
 * Body: { sku: string; productId: string; field: "skuBros" | "skuAmz" | "skuShopify" }
 * Gắn SKU Bros vào sản phẩm.
 */
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sku, productId, field = "skuBros" } = body;

  if (!sku || !productId) {
    return Response.json({ error: "Cần truyền sku và productId" }, { status: 400 });
  }

  const allowedFields = ["skuBros", "skuAmz", "skuShopify"];
  if (!allowedFields.includes(field)) {
    return Response.json({ error: "field không hợp lệ" }, { status: 400 });
  }

  await prisma.product.update({
    where: { id: productId },
    data: { [field]: sku },
  });

  return Response.json({ ok: true });
}
