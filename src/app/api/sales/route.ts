import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const orders = await prisma.shopifyOrder.findMany({
      orderBy: { createdAtShopify: "desc" },
    });

    const salesItems: any[] = [];

    for (const order of orders) {
      if (order.financialStatus !== "paid") continue; // Chỉ tính đơn hàng đã thanh toán

      let lineItems: any[] = [];
      try {
        lineItems = JSON.parse(order.lineItemsJson || "[]");
      } catch (e) {
        continue;
      }

      for (const item of lineItems) {
        let channel = "Mặc định (Shopify)";
        if (order.sourceName === "tiktok" || order.paymentGateway?.toLowerCase().includes("tiktok")) {
          channel = "TikTok";
        } else if (order.sourceName === "web") {
          channel = "Website Shopify";
        }

        salesItems.push({
          id: `${order.shopifyId}-${item.id}`,
          orderId: order.shopifyId,
          orderName: order.orderName,
          orderDate: order.createdAtShopify,
          sku: item.sku || "",
          productName: item.title + (item.variant_title && item.variant_title !== "Default Title" ? ` - ${item.variant_title}` : ""),
          quantity: item.quantity,
          priceUsd: parseFloat(item.price || "0"),
          subtotalUsd: parseFloat(item.price || "0") * item.quantity,
          sourceName: order.sourceName || "web",
          channel: channel,
        });
      }
    }

    return NextResponse.json(salesItems);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
