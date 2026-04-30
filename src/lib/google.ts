import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/** Lấy refresh token: ưu tiên DB (lưu sau OAuth), fallback về .env */
export async function getRefreshToken(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: "googleRefreshToken" } });
  return row?.value || process.env.GOOGLE_REFRESH_TOKEN || null;
}

/** Trả về Sheets API client đã xác thực */
export async function getSheetsClient() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new Error("Chưa cấu hình Google token. Vào Cài đặt → Kết nối Google.");
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.sheets({ version: "v4", auth: client });
}

export const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
