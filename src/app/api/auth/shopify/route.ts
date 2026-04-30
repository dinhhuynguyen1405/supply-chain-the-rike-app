import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  let shop = url.searchParams.get("shop");

  if (!shop) {
    const settings = await prisma.setting.findMany();
    const config = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
    shop = config.shopifyStoreDomain || process.env.SHOPIFY_STORE_DOMAIN || null;
  }

  if (!shop) {
    return NextResponse.json({ error: "Vui lòng nhập Shopify Store Domain trong Cài đặt" }, { status: 400 });
  }

  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  
  if (!clientId) {
    return NextResponse.json({ error: "Thiếu SHOPIFY_CLIENT_ID trong .env" }, { status: 400 });
  }

  const scopes = "read_orders,read_products,read_inventory,read_customers";
  const redirectUri = `${url.origin}/api/auth/shopify/callback`;

  const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}`;
  
  return NextResponse.redirect(authUrl);
}
