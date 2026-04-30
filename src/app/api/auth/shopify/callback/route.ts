import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");
  const code = url.searchParams.get("code");

  if (!shop || !code) {
    return NextResponse.json({ error: "Tham số không hợp lệ từ Shopify" }, { status: 400 });
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_API_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Thiếu cấu hình Client ID / Secret" }, { status: 500 });
  }

  try {
    // Gọi API để đổi code lấy access token (shpat_...)
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return NextResponse.json({ error: "Không thể lấy token", details: errText }, { status: tokenResponse.status });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Lưu Access Token và Domain vào database
    await prisma.setting.upsert({
      where: { key: "shopifyAccessToken" },
      update: { value: accessToken },
      create: { key: "shopifyAccessToken", value: accessToken },
    });

    await prisma.setting.upsert({
      where: { key: "shopifyStoreDomain" },
      update: { value: shop },
      create: { key: "shopifyStoreDomain", value: shop },
    });

    // Chuyển hướng về lại trang Cài đặt kèm thông báo thành công
    return NextResponse.redirect(`${url.origin}/settings?auth=success`);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
