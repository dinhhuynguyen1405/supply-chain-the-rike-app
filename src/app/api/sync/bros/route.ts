import { prisma } from "@/lib/prisma";
import { getSheetsClient, getRefreshToken } from "@/lib/google";

// Bros Warehouse sheet — CHỈ ĐỌC, không bao giờ ghi vào
const BROS_SPREADSHEET_ID = "1I_IQNSq8iZPM-MqyjswYN5juJo6xadudRBU8Pwcj5WI";
const INVENTORY_TAB = "Inventory";

/** Parse CSV dòng — xử lý quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/** Đọc Bros sheet qua public CSV URL (không cần OAuth) */
async function readBrosSheetPublic(): Promise<{ rows: string[][]; error?: string }> {
  const url = `https://docs.google.com/spreadsheets/d/${BROS_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(INVENTORY_TAB)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) {
      return { rows: [], error: `HTTP ${res.status} khi đọc sheet Bros` };
    }
    const text = await res.text();
    if (text.startsWith("<!DOCTYPE") || text.includes("<html")) {
      return { rows: [], error: "Sheet Bros chưa được share public hoặc không tìm thấy tab Inventory" };
    }
    const lines = text.split("\n").filter((l) => l.trim());
    const rows = lines.map(parseCSVLine);
    return { rows };
  } catch (e) {
    return { rows: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Process rows → upsert vào WarehouseStock */
async function processInventoryRows(rows: string[][]): Promise<{ syncedCount: number; skipped: string[] }> {
  if (rows.length < 2) return { syncedCount: 0, skipped: ["Sheet trống hoặc chỉ có header"] };

  const header = rows[0].map((h) => h.toLowerCase().replace(/"/g, "").trim());

  const colIdx = (keywords: string[]) =>
    header.findIndex((h) => keywords.some((kw) => h.includes(kw)));

  const skuCol      = colIdx(["amz barcode", "barcode", "sku", "upc", "asin"]);
  const inStockCol  = colIdx(["total in stock", "in stock", "instock", "available", "qty", "quantity", "stock"]);
  const inStockNewCol = colIdx(["in stock (new)", "in stock new", "instock new"]);
  const receivedCol = colIdx(["total received", "received"]);
  const shippedCol  = colIdx(["total shipped", "shipped"]);
  const waitingCol  = colIdx(["waiting", "in transit", "transit"]);
  const damagedCol  = colIdx(["damaged", "damage"]);
  const descCol     = colIdx(["description", "product description", "product", "title", "name", "item"]);
  const typeCol     = colIdx(["product type", "type", "category"]);
  const unitCol     = colIdx(["unit"]);

  if (skuCol === -1 || inStockCol === -1) {
    return {
      syncedCount: 0,
      skipped: [`Không tìm được cột SKU (col ${skuCol}) hoặc In Stock (col ${inStockCol}). Headers: ${header.join(", ")}`],
    };
  }

  const skipped: string[] = [];
  const upserts: Promise<unknown>[] = [];
  let syncedCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sku = String(row[skuCol] ?? "").replace(/"/g, "").trim();
    if (!sku) { skipped.push(`Row ${i + 1}: empty SKU`); continue; }

    const parseNum = (col: number) =>
      col !== -1 ? parseFloat(String(row[col] ?? "0").replace(/[",]/g, "")) || 0 : 0;

    const inStock    = parseNum(inStockCol);
    const inStockNew = parseNum(inStockNewCol);
    const received   = parseNum(receivedCol);
    const shipped    = parseNum(shippedCol);
    const waiting    = parseNum(waitingCol);
    const damaged    = parseNum(damagedCol);
    const description = descCol !== -1 ? String(row[descCol] ?? "").replace(/"/g, "").trim() : undefined;
    const unit        = unitCol !== -1 ? String(row[unitCol] ?? "").replace(/"/g, "").trim() : undefined;

    upserts.push(
      prisma.warehouseStock.upsert({
        where: { sku_warehouse: { sku, warehouse: "bros" } },
        update: { inStock, inStockNew, received, shipped, waiting, damaged, description: description || undefined, unit: unit || undefined, lastSyncedAt: new Date() },
        create: { sku, warehouse: "bros", inStock, inStockNew, received, shipped, waiting, damaged, description: description || undefined, unit: unit || undefined, lastSyncedAt: new Date() },
      })
    );
    syncedCount++;
  }

  for (let i = 0; i < upserts.length; i += 50) {
    await Promise.all(upserts.slice(i, i + 50));
  }

  return { syncedCount, skipped };
}

/**
 * POST /api/sync/bros
 * Ưu tiên: đọc qua public CSV URL trước (không cần OAuth).
 * Fallback: dùng Google Sheets API nếu có OAuth token.
 */
export async function POST() {
  try {
    // ── Thử đọc qua public URL trước (không cần OAuth) ──────────────────────
    const { rows, error: publicErr } = await readBrosSheetPublic();

    if (rows.length >= 2) {
      const { syncedCount, skipped } = await processInventoryRows(rows);
      const totalInDB = await prisma.warehouseStock.count({ where: { warehouse: "bros" } });
      return Response.json({
        ok: true,
        method: "public_csv",
        inventoryTab: INVENTORY_TAB,
        syncedRows: syncedCount,
        totalInDB,
        skipped: skipped.length,
        skippedDetails: skipped.slice(0, 10),
      });
    }

    // ── Fallback: Google Sheets API với OAuth ────────────────────────────────
    const token = await getRefreshToken();
    if (!token) {
      return Response.json(
        {
          error: publicErr
            ? `Không đọc được sheet qua URL công khai (${publicErr}) và chưa kết nối Google OAuth. Vào Cài đặt → Kết nối Google.`
            : "Sheet Bros chưa share public. Vào Cài đặt → Kết nối Google.",
        },
        { status: 400 }
      );
    }

    const sheets = await getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: BROS_SPREADSHEET_ID });
    const tabTitles = (meta.data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
    const inventoryTabCandidates = ["Inventory", "Current Inventory", "Stock", "Tồn kho", "inventory"];
    const inventoryTab = inventoryTabCandidates.find((t) => tabTitles.includes(t)) ?? null;

    if (!inventoryTab) {
      return Response.json({ error: `Không tìm thấy tab Inventory. Tabs: ${tabTitles.join(", ")}` }, { status: 400 });
    }

    const res = await sheets.spreadsheets.values.get({ spreadsheetId: BROS_SPREADSHEET_ID, range: `${inventoryTab}!A:Z` });
    const oauthRows = (res.data.values ?? []) as string[][];
    const { syncedCount, skipped } = await processInventoryRows(oauthRows);
    const totalInDB = await prisma.warehouseStock.count({ where: { warehouse: "bros" } });

    return Response.json({ ok: true, method: "google_oauth", inventoryTab, syncedRows: syncedCount, totalInDB, skipped: skipped.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/sync/bros
 * Trả về dữ liệu kho Bros đã lưu trong DB (không cần Google auth)
 */
export async function GET() {
  const stocks = await prisma.warehouseStock.findMany({
    where: { warehouse: "bros" },
    orderBy: { sku: "asc" },
  });
  return Response.json(stocks);
}
