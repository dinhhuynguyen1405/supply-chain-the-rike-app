import { getOAuthClient } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return new Response("Missing code", { status: 400 });

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (tokens.refresh_token) {
    // Lưu refresh token vào DB settings để không cần sửa .env
    await prisma.setting.upsert({
      where: { key: "googleRefreshToken" },
      update: { value: tokens.refresh_token },
      create: { key: "googleRefreshToken", value: tokens.refresh_token },
    });
  }

  const hasToken = !!tokens.refresh_token;

  return new Response(
    `<html><head><meta charset="utf-8"></head><body style="font-family:sans-serif;padding:32px;max-width:600px">
      ${hasToken
        ? `<h2 style="color:#16a34a">✅ Kết nối Google thành công!</h2>
           <p>Token đã được lưu tự động. Bạn có thể đóng tab này và quay lại trang Cài đặt.</p>
           <script>setTimeout(()=>{ window.location.href="/settings"; }, 2000);</script>`
        : `<h2 style="color:#dc2626">⚠️ Không lấy được refresh token</h2>
           <p>Thử lại: <a href="/api/auth/google">/api/auth/google</a></p>
           <p style="color:gray;font-size:12px">Lưu ý: Google chỉ trả về refresh_token ở lần đầu tiên cấp quyền.
           Nếu bạn đã cấp trước đây, vào <a href="https://myaccount.google.com/permissions" target="_blank">Google Account → Permissions</a>,
           xoá quyền của app này rồi thử lại.</p>`
      }
    </body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
