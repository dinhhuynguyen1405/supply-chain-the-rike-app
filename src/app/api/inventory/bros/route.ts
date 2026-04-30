/**
 * GET /api/inventory/bros
 * Đọc thẳng từ sheet kho Bros — không dùng DB cache.
 * Trả về:
 *   skuMap:  { [sku]: qty }         — khớp bằng AMZ barcode / Shopify SKU
 *   nameMap: { [normalized]: qty }  — khớp bằng tên sản phẩm (đã chuẩn hóa)
 *   items:   [{ sku, name, qty }]   — danh sách đầy đủ để hiện sản phẩm "chỉ có ở Bros"
 */
import { getSheetsClient, getRefreshToken } from "@/lib/google";

const BROS_SPREADSHEET_ID = "1I_IQNSq8iZPM-MqyjswYN5juJo6xadudRBU8Pwcj5WI";

/** Chuẩn hóa tên để so sánh: lowercase, bỏ trọng lượng đầu/cuối, bỏ ký tự đặc biệt */
function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^\d+[\s\-x]*\d*\s*(gram|g|kg|oz|lb|pack|pcs|pieces?)\s*/i, "") // bỏ "100g " đầu
    .replace(/\s*[\|\-]\s*.*/g, "") // bỏ phần sau | hoặc -
    .replace(/[®™©]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface BrosInventoryResponse {
  skuMap: Record<string, number>;
  nameMap: Record<string, number>;
  items: { sku: string; name: string; qty: number }[];
}

export async function GET() {
  const token = await getRefreshToken();
  if (!token) {
    return Response.json({ error: "no_token" }, { status: 400 });
  }

  try {
    const sheets = await getSheetsClient();

    // Lấy danh sách tab
    const meta = await sheets.spreadsheets.get({ spreadsheetId: BROS_SPREADSHEET_ID });
    const tabTitles = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter(Boolean);

    const candidates = ["Inventory", "Current Inventory", "Stock", "inventory"];
    const inventoryTab = candidates.find((t) => tabTitles.includes(t));

    if (!inventoryTab) {
      return Response.json(
        { error: `Không tìm thấy tab Inventory. Các tab hiện có: ${tabTitles.join(", ")}` },
        { status: 404 }
      );
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: BROS_SPREADSHEET_ID,
      range: `${inventoryTab}!A:Z`,
    });

    const rows = (res.data.values ?? []) as string[][];
    if (rows.length < 2) {
      return Response.json({ skuMap: {}, nameMap: {}, items: [] });
    }

    const header = rows[0].map((h) => String(h).toLowerCase().trim());

    // Tìm cột SKU (AMZ barcode)
    const skuCol = header.findIndex(
      (h) =>
        h.includes("amz barcode") ||
        h.includes("barcode") ||
        h.includes("sku") ||
        h.includes("upc") ||
        h.includes("asin")
    );

    // Tìm cột tên sản phẩm — ưu tiên "description" (Bros sheet dùng "Product Description")
    const nameCol = header.findIndex((h) => h.includes("description")) !== -1
      ? header.findIndex((h) => h.includes("description"))
      : header.findIndex(
          (h) => h.includes("title") || h.includes("name") || h.includes("product") || h === "item"
        );

    // Tìm cột số lượng
    const colIdx = (keywords: string[]) =>
      header.findIndex((h) => keywords.some((kw) => h.includes(kw)));

    const inStockCol =
      colIdx(["total in stock"]) !== -1
        ? colIdx(["total in stock"])
        : colIdx(["in stock", "instock", "available", "qty", "quantity", "stock"]);

    if (inStockCol === -1) {
      return Response.json(
        {
          error: `Không tìm thấy cột Qty. Headers: ${rows[0].join(", ")}`,
          headers: rows[0],
        },
        { status: 400 }
      );
    }

    const skuMap: Record<string, number> = {};
    const nameMap: Record<string, number> = {};
    const items: { sku: string; name: string; qty: number }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const sku = skuCol !== -1 ? String(row[skuCol] ?? "").trim() : "";
      const name = nameCol !== -1 ? String(row[nameCol] ?? "").trim() : "";
      const qty = parseFloat(String(row[inStockCol] ?? "0").replace(/,/g, "")) || 0;

      if (!sku && !name) continue;

      if (sku) skuMap[sku] = qty;
      if (name) nameMap[normalizeName(name)] = qty;

      items.push({ sku, name, qty });
    }

    return Response.json({ skuMap, nameMap, items } satisfies BrosInventoryResponse);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
