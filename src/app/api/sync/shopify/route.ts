import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const urlParams = new URL(req.url);
    const syncType = urlParams.searchParams.get("type") || "orders";

    // Lấy cài đặt từ DB
    const settings = await prisma.setting.findMany();
    const config = settings.reduce(
      (acc, s) => ({ ...acc, [s.key]: s.value }),
      {} as Record<string, string>
    );

    const domainRaw =
      config.shopifyStoreDomain || process.env.SHOPIFY_STORE_DOMAIN;
    const domain = domainRaw?.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const accessToken =
      config.shopifyAccessToken ||
      config.shopifyApiSecret ||
      process.env.SHOPIFY_API_SECRET;

    if (!domain || !accessToken) {
      return NextResponse.json(
        { error: "Chưa cấu hình Shopify Store Domain hoặc Token" },
        { status: 400 }
      );
    }

    if (syncType === "products") {
      // Fetch all products with pagination
      let allProducts: ShopifyProduct[] = [];
      let pageUrl = `https://${domain}/admin/api/2024-01/products.json?limit=250`;

      while (pageUrl) {
        const response = await fetch(pageUrl, {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
        });

        if (!response.ok) {
          const err = await response.text();
          return NextResponse.json(
            { error: `Shopify Error: ${err}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        allProducts = allProducts.concat(data.products || []);

        // Check for next page via Link header
        const linkHeader = response.headers.get("Link") || "";
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        pageUrl = nextMatch ? nextMatch[1] : "";
      }

      let createdCount = 0;
      let updatedCount = 0;

      for (const product of allProducts) {
        // Get all variant SKUs for this product
        const variantSkus = product.variants
          .map((v: ShopifyVariant) => v.sku)
          .filter(Boolean);

        // The primary SKU = first variant with a SKU
        const firstSku = variantSkus[0] || null;

        // Check if a product already exists matching by name OR any variant SKU
        const existing = await prisma.product.findFirst({
          where: {
            OR: [
              { name: product.title },
              ...(variantSkus.length > 0
                ? [{ skuShopify: { in: variantSkus } }]
                : []),
            ],
          },
        });

        const unit =
          product.product_type?.toLowerCase().includes("seed") ? "pack" : "unit";

        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: product.title,
              category: product.product_type || existing.category,
              // Only update skuShopify if currently empty
              ...(existing.skuShopify == null && firstSku
                ? { skuShopify: firstSku }
                : {}),
            },
          });
          updatedCount++;
        } else {
          // Create ONE product per Shopify product (not per variant)
          await prisma.product.create({
            data: {
              name: product.title,
              nameVi: null,
              skuShopify: firstSku,
              unit,
              category: product.product_type || null,
              gramsPerUnit: null,
            },
          });
          createdCount++;
        }
      }

      return NextResponse.json({
        success: true,
        created: createdCount,
        updated: updatedCount,
        total: allProducts.length,
      });
    } else {
      // Orders sync — paginate properly
      let allOrders: ShopifyOrder[] = [];
      let pageUrl = `https://${domain}/admin/api/2024-01/orders.json?status=any&limit=250`;

      while (pageUrl) {
        const response = await fetch(pageUrl, {
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
        });

        if (!response.ok) {
          const err = await response.text();
          return NextResponse.json(
            { error: `Shopify Error: ${err}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        allOrders = allOrders.concat(data.orders || []);

        // Check for next page via Link header
        const linkHeader = response.headers.get("Link") || "";
        const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        pageUrl = nextMatch ? nextMatch[1] : "";
      }

      let createdCount = 0;

      // Extract this out to reuse the warehouse logic
      async function assignWarehouseForOrder(
        items: { skuRaw: string | null }[]
      ): Promise<"nhung" | "bros"> {
        const skusToCheck = items.map(i => i.skuRaw).filter(Boolean) as string[];
        if (skusToCheck.length === 0) return "nhung";
        
        const brosStocks = await prisma.warehouseStock.findMany({
          where: { 
            warehouse: "bros",
            sku: { in: skusToCheck },
            inStock: { gt: 0 }
          }
        });

        if (brosStocks.length > 0) return "bros";
        return "nhung";
      }

      for (const order of allOrders) {
        const orderId = order.id.toString();
        const sourceName = order.source_name || "";
        const paymentGateway = order.payment_gateway_names?.[0] || "";

        const savedOrder = await prisma.shopifyOrder.upsert({
          where: { shopifyId: orderId },
          update: {
            financialStatus: order.financial_status,
            fulfillmentStatus: order.fulfillment_status,
            totalPriceUsd: parseFloat(order.total_price),
            sourceName,
            paymentGateway,
            syncedAt: new Date(),
          },
          create: {
            shopifyId: orderId,
            orderName: order.name,
            email: order.email || "",
            financialStatus: order.financial_status,
            fulfillmentStatus: order.fulfillment_status,
            totalPriceUsd: parseFloat(order.total_price),
            lineItemsJson: JSON.stringify(order.line_items),
            sourceName,
            paymentGateway,
            createdAtShopify: new Date(order.created_at),
          },
        });

        // Tự động tạo Lệnh Đóng Hàng (FulfillmentOrder) nếu chưa có
        if (!savedOrder.fulfillmentOrderId && order.fulfillment_status !== "fulfilled") {
          // Explicitly type line_items from the generic unknown
          const lineItems = order.line_items as { sku?: string; name?: string; quantity?: number }[];
          
          // Map line items to system products via SKU
          const skus = lineItems.map(li => li.sku).filter((x): x is string => Boolean(x));
          const matchedProducts = await prisma.product.findMany({
            where: {
              OR: [
                { skuShopify: { in: skus } },
                { skuAmz: { in: skus } }
              ]
            }
          });

          const fulfillmentItemsData = lineItems.map(li => {
            const productMatch = matchedProducts.find(p => p.skuShopify === li.sku || p.skuAmz === li.sku);
            return {
              productId: productMatch?.id || null,
              skuRaw: li.sku || null,
              productName: li.name || "Unknown Item",
              quantity: Number(li.quantity || 0),
            };
          });

          // Auto Assign Kho cho đơn vừa kéo về
          const warehouseSource = await assignWarehouseForOrder(fulfillmentItemsData);

          const { generateFulfillmentCode } = await import("@/lib/utils");
          
          const fulfillmentCode = generateFulfillmentCode();
          
          // Define shipping address data (check if Shopify returns shipping_address)
          const shippingAddress = (order as any).shipping_address;
          const customerAddressStr = shippingAddress ? 
            `${shippingAddress.address1 || ""}, ${shippingAddress.city || ""}, ${shippingAddress.province || ''}, ${shippingAddress.country || ""}, ${shippingAddress.zip || ""}`
            : null;

          const fOrder = await prisma.fulfillmentOrder.create({
            data: {
              code: fulfillmentCode,
              source: "shopify",
              shopifyOrderId: orderId,
              customerName: shippingAddress?.name || order.email || "Khách Shopify",
              customerAddress: customerAddressStr,
              warehouseSource,
              items: {
                create: fulfillmentItemsData.map(item => ({
                  ...item,
                  warehouseSource
                }))
              }
            }
          });

          // Cập nhật lại shopifyOrder để link sang fulfillmentOrder
          await prisma.shopifyOrder.update({
            where: { id: savedOrder.id },
            data: { fulfillmentOrderId: fOrder.id }
          });
        }
        
        createdCount++;
      }

      return NextResponse.json({ success: true, count: createdCount });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Shopify sync error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Local type helpers ─────────────────────────────────────────────────────

interface ShopifyVariant {
  id: number;
  sku: string;
  title: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  product_type: string;
  variants: ShopifyVariant[];
}

interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  financial_status: string;
  fulfillment_status: string;
  total_price: string;
  line_items: unknown[];
  source_name: string;
  payment_gateway_names: string[];
  created_at: string;
}
