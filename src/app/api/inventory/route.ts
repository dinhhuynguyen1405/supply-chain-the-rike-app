import { prisma } from "@/lib/prisma";

export interface InventoryProduct {
  id: string;
  name: string;
  nameVi: string | null;
  skuShopify: string | null;
  skuAmz: string | null;     // AMZ barcode — dùng để match với kho Bros
  unit: string;
  gramsPerUnit: number | null;
  restockThreshold: number | null;
  category: string | null;
  // calculated
  purchasedUnits: number;   // packs / gói available (after conversion)
  soldUnits: number;        // packs sold
  stockUnits: number;       // purchasedUnits - soldUnits
  lowStock: boolean;
}

/** Convert a purchase quantity (in raw purchase unit) to selling units (packs) */
function toSellingUnits(quantity: number, unit: string, gramsPerUnit: number | null): number {
  if (gramsPerUnit && unit === "kg") {
    return Math.floor((quantity * 1000) / gramsPerUnit);
  }
  return quantity;
}

export async function GET() {
  const products = await prisma.product.findMany({
    orderBy: { nameVi: "asc" },
    include: {
      purchaseItems: {
        include: {
          purchaseOrder: { select: { status: true } },
        },
      },
      salesItems: {
        select: { quantity: true },
      },
    },
  });

  const inventory: InventoryProduct[] = products.map((p) => {
    // Only count stock from orders that have actually arrived / been received
    const arrivedStatuses = ["arrived", "completed"];
    const purchasedUnits = p.purchaseItems
      .filter((pi) => arrivedStatuses.includes(pi.purchaseOrder.status))
      .reduce((sum, pi) => sum + toSellingUnits(pi.quantity, p.unit, p.gramsPerUnit), 0);

    const soldUnits = p.salesItems.reduce((sum, si) => sum + si.quantity, 0);
    const stockUnits = purchasedUnits - soldUnits;
    const threshold = p.restockThreshold ?? 10;

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
      purchasedUnits,
      soldUnits,
      stockUnits,
      lowStock: stockUnits <= threshold,
    };
  });

  return Response.json(inventory);
}
