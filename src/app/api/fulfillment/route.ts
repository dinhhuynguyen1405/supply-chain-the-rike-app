import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { generateFulfillmentCode } from "@/lib/utils";
import { triggerSheetSync } from "@/lib/sync-trigger";

/**
 * Tự động phân công kho cho TOÀN BỘ order theo rule:
 * - Không có order "mixed". Toàn bộ 1 order chỉ thuộc 1 kho.
 * - Hàng hiện tại trên Shopify = Kho Nhung (chưa trùng nhau).
 * - Sắp tới có hàng Bros: Nếu phát hiện SKU đó có tồn kho khai báo ở Bros → Order thuộc Bros.
 * - Ngược lại mặc định rơi về Kho Nhung.
 */
async function assignWarehouseForOrder(
  items: { productId: string | null; quantity: number }[]
): Promise<"nhung" | "bros"> {
  const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
  
  if (productIds.length === 0) return "nhung";

  // Lấy info products để lấy SKU
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, skuAmz: true, skuShopify: true },
  });

  const skusToCheck = products.flatMap(p => [p.skuAmz, p.skuShopify].filter(Boolean) as string[]);
  if (skusToCheck.length === 0) return "nhung";

  // Check xem có SKU nào thuộc kho Bros không (có khai báo ở kho Bros)
  const brosStocks = await prisma.warehouseStock.findMany({
    where: { 
      warehouse: "bros",
      sku: { in: skusToCheck },
      inStock: { gt: 0 } // Nếu khai báo ở kho bros và inStock > 0 thì assign bros
    }
  });

  // Theo rule: Không có order mixed, hàng không trùng nhau. 
  // Nếu có item bất kỳ nào thuộc diện của Bros (tức là map được SKU ở bảng WarehouseStock của bros)
  // thì phán toàn bộ Order đó là Bros.
  if (brosStocks.length > 0) {
    return "bros";
  }

  // Mặc định, hiện tại Shopify và các đơn hàng khác đều là của Nhung
  return "nhung";
}

export async function GET() {
  const orders = await prisma.fulfillmentOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } } },
  });

  // Map FulfillmentOrders that have a shopifyOrderId to their ShopifyOrder fulfillmentStatus.
  // If the Shopify order is already "fulfilled", mark the FulfillmentOrder accordingly so
  // the front-end can exclude it from active notifications automatically.
  const shopifyOrderIds = orders
    .map((o) => o.shopifyOrderId)
    .filter(Boolean) as string[];

  let fulfilledSet = new Set<string>();
  if (shopifyOrderIds.length > 0) {
    const shopifyOrders = await prisma.shopifyOrder.findMany({
      where: {
        OR: [
          { orderName: { in: shopifyOrderIds } },
          { shopifyId: { in: shopifyOrderIds } },
        ],
        fulfillmentStatus: "fulfilled",
      },
      select: { orderName: true, shopifyId: true },
    });
    shopifyOrders.forEach((so) => {
      fulfilledSet.add(so.orderName);
      fulfilledSet.add(so.shopifyId);
    });
  }

  const enriched = orders.map((o) => ({
    ...o,
    shopifyFulfilled: o.shopifyOrderId ? fulfilledSet.has(o.shopifyOrderId) : false,
  }));

  return Response.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const rawItems: {
    productId?: string | null;
    skuRaw?: string | null;
    productName: string;
    quantity: number;
    notes?: string | null;
  }[] = body.items ?? [];

  // Auto-assign warehouse per order
  const warehouseSource = await assignWarehouseForOrder(
    rawItems.map((i) => ({ productId: i.productId ?? null, quantity: Number(i.quantity) }))
  );

  const order = await prisma.fulfillmentOrder.create({
    data: {
      code: generateFulfillmentCode(),
      source: body.source,
      shopifyOrderId: body.shopifyOrderId || null,
      customerName: body.customerName || null,
      customerAddress: body.customerAddress || null,
      customerNote: body.customerNote || null,
      noteSentToTd: body.noteSentToTd || null,
      notes: body.notes || null,
      warehouseSource,
      items: {
        create: rawItems.map((item, idx) => ({
          productId: item.productId || null,
          skuRaw: item.skuRaw || null,
          productName: item.productName,
          quantity: Number(item.quantity),
          notes: item.notes || null,
          warehouseSource, // Assigned same to all items
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  triggerSheetSync("fbm");
  triggerSheetSync("nhung_orders");
  return Response.json(order, { status: 201 });
}
