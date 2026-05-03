import { prisma } from "@/lib/prisma";
import { toSellingUnits } from "@/lib/utils";

export interface InventoryProduct {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  skuAmz: string | null;
  unit: string;
  gramsPerUnit: number | null;
  restockThreshold: number | null;
  category: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  // Kho thực tế (nguồn chính xác)
  nhungQty: number;
  brosQty: number;
  stockUnits: number;   // nhungQty + brosQty
  lowStock: boolean;
  // Legacy computed (dùng cho context lịch sử)
  purchasedUnits: number;
  soldUnits: number;
}

export async function GET() {
  const [products, brosStocks] = await Promise.all([
    prisma.product.findMany({
      orderBy: { nameVi: "asc" },
      include: {
        purchaseItems: {
          include: { purchaseOrder: { select: { status: true } } },
        },
        salesItems: { select: { quantity: true } },
      },
    }),
    prisma.warehouseStock.findMany({ where: { warehouse: "bros" } }),
  ]);

  // Bros map: sku → inStock
  const brosMap: Record<string, number> = {};
  for (const s of brosStocks) brosMap[s.sku] = (brosMap[s.sku] ?? 0) + s.inStock;

  const inventory: InventoryProduct[] = products.map((p) => {
    // Tồn kho thực = nhungQty + brosQty (nguồn chính xác)
    // Bros lookup: skuBros (mới) → skuAmz (legacy) → skuShopify (fallback)
    const brosQty =
      (p.skuBros ? brosMap[p.skuBros] : null) ??
      (p.skuAmz ? brosMap[p.skuAmz] : null) ??
      (p.skuShopify ? brosMap[p.skuShopify] : null) ??
      0;
    const stockUnits = p.nhungQty + brosQty;
    const threshold = p.restockThreshold ?? 10;

    // Legacy: tính từ purchase - sales (dùng cho context lịch sử)
    const arrivedStatuses = ["arrived", "completed"];
    const purchasedUnits = p.purchaseItems
      .filter((pi) => arrivedStatuses.includes(pi.purchaseOrder.status))
      .reduce((sum, pi) => sum + toSellingUnits(pi.quantity, p.unit, p.gramsPerUnit), 0);
    const soldUnits = p.salesItems.reduce((sum, si) => sum + si.quantity, 0);

    return {
      id: p.id,
      name: p.name,
      nameVi: p.nameVi,
      skuShopify: p.skuShopify,
      skuAmz: p.skuAmz,
      unit: p.unit,
      gramsPerUnit: p.gramsPerUnit,
      restockThreshold: p.restockThreshold,
      category: p.category,
      imageUrl: p.imageUrl,
      priceUsd: p.priceUsd,
      nhungQty: p.nhungQty,
      brosQty,
      stockUnits,
      lowStock: stockUnits > 0 && stockUnits <= threshold,
      purchasedUnits,
      soldUnits,
    };
  });

  return Response.json(inventory);
}
