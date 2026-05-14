/**
 * GET  /api/inventory/bros-map   — Danh sách tất cả Bros SKUs với trạng thái mapping
 * POST /api/inventory/bros-map   — Link 1 Bros SKU → product (hoặc tạo mới)
 * PUT  /api/inventory/bros-map   — Auto-map tất cả high-confidence matches
 */
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

function similarity(a: string, b: string): number {
  a = a.toLowerCase().replace(/[^a-z0-9àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵýỷỹ\s]/g, " ").trim();
  b = b.toLowerCase().replace(/[^a-z0-9àáâãèéêìíòóôõùúăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵýỷỹ\s]/g, " ").trim();
  const wordsA = a.split(/\s+/).filter((w) => w.length > 1);
  const wordsB = b.split(/\s+/).filter((w) => w.length > 1);
  if (!wordsA.length || !wordsB.length) return 0;
  let matches = 0;
  for (const wa of wordsA) {
    if (wordsB.some((wb) => wb.includes(wa) || wa.includes(wb))) matches++;
  }
  return matches / Math.max(wordsA.length, wordsB.length);
}

export async function GET() {
  const [brosStocks, products] = await Promise.all([
    prisma.warehouseStock.findMany({
      where: { warehouse: "bros" },
      orderBy: { sku: "asc" },
    }),
    prisma.product.findMany({
      select: { id: true, name: true, nameVi: true, skuShopify: true, skuAmz: true, skuBros: true },
    }),
  ]);

  // Build match lookup: brosStockSku → product
  const skuToProduct = new Map<string, typeof products[0]>();
  for (const p of products) {
    if (p.skuBros) skuToProduct.set(p.skuBros, p);
    if (p.skuAmz && !skuToProduct.has(p.skuAmz)) skuToProduct.set(p.skuAmz, p);
    if (p.skuShopify && !skuToProduct.has(p.skuShopify)) skuToProduct.set(p.skuShopify, p);
  }

  const result = brosStocks.map((b) => {
    const matched = skuToProduct.get(b.sku);

    // Compute suggestions for unmatched
    let suggestions: { id: string; name: string; nameVi: string | null; skuShopify: string | null; score: number }[] = [];
    if (!matched && b.description) {
      suggestions = products
        .map((p) => {
          const haystack = `${p.name} ${p.nameVi ?? ""}`;
          const score = similarity(b.description!, haystack);
          return { id: p.id, name: p.name, nameVi: p.nameVi, skuShopify: p.skuShopify, score };
        })
        .filter((s) => s.score > 0.25)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
    }

    return {
      sku: b.sku,
      description: b.description,
      inStock: b.inStock,
      inStockNew: b.inStockNew,
      received: b.received,
      shipped: b.shipped,
      waiting: b.waiting,
      lastSyncedAt: b.lastSyncedAt,
      matched: matched
        ? { id: matched.id, name: matched.name, nameVi: matched.nameVi, skuShopify: matched.skuShopify }
        : null,
      suggestions,
    };
  });

  const stats = {
    total: result.length,
    matched: result.filter((r) => r.matched).length,
    unmatched: result.filter((r) => !r.matched).length,
    withSuggestions: result.filter((r) => !r.matched && r.suggestions.length > 0).length,
  };

  return Response.json({ items: result, stats });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, sku, productId, description, inStock } = body;

  if (action === "link") {
    // Link Bros SKU → existing product
    if (!sku || !productId) {
      return Response.json({ error: "Cần sku và productId" }, { status: 400 });
    }
    // Check if another product already has this skuBros → unset it first
    await prisma.product.updateMany({
      where: { skuBros: sku, id: { not: productId } },
      data: { skuBros: null },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { skuBros: sku },
    });
    return Response.json({ ok: true, action: "linked" });
  }

  if (action === "unlink") {
    // Unlink: set skuBros = null on product that had this sku
    if (!productId) return Response.json({ error: "Cần productId" }, { status: 400 });
    await prisma.product.update({
      where: { id: productId },
      data: { skuBros: null },
    });
    return Response.json({ ok: true, action: "unlinked" });
  }

  if (action === "create") {
    // Create new product from Bros data
    if (!sku) return Response.json({ error: "Cần sku" }, { status: 400 });
    const newProduct = await prisma.product.create({
      data: {
        name: description ?? sku,
        nameVi: null,
        skuBros: sku,
        unit: "gói",
      },
    });
    return Response.json({ ok: true, action: "created", productId: newProduct.id });
  }

  return Response.json({ error: "action không hợp lệ (link|unlink|create)" }, { status: 400 });
}

export async function PUT() {
  // Auto-map: for all unmatched Bros items, if there's a suggestion with score >= 0.6, auto-link
  const [brosStocks, products] = await Promise.all([
    prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
    prisma.product.findMany({
      select: { id: true, name: true, nameVi: true, skuShopify: true, skuAmz: true, skuBros: true },
    }),
  ]);

  const matchedSkus = new Set<string>();
  for (const p of products) {
    if (p.skuBros) matchedSkus.add(p.skuBros);
    if (p.skuAmz) matchedSkus.add(p.skuAmz);
    if (p.skuShopify) matchedSkus.add(p.skuShopify);
  }

  const unmatched = brosStocks.filter((b) => !matchedSkus.has(b.sku) && b.description);

  let autoMapped = 0;
  const mappings: { sku: string; productId: string; productName: string; score: number }[] = [];

  for (const b of unmatched) {
    let best: { id: string; name: string; nameVi: string | null; score: number } | null = null;
    for (const p of products) {
      const haystack = `${p.name} ${p.nameVi ?? ""}`;
      const score = similarity(b.description!, haystack);
      if (score > (best?.score ?? 0.59)) {
        best = { id: p.id, name: p.name, nameVi: p.nameVi, score };
      }
    }
    if (best && best.score >= 0.6) {
      // Check this product doesn't already have a Bros SKU
      const existing = products.find((p) => p.id === best!.id);
      if (!existing?.skuBros) {
        await prisma.product.update({
          where: { id: best.id },
          data: { skuBros: b.sku },
        });
        autoMapped++;
        mappings.push({ sku: b.sku, productId: best.id, productName: best.nameVi ?? best.name, score: best.score });
      }
    }
  }

  return Response.json({ ok: true, autoMapped, mappings });
}
