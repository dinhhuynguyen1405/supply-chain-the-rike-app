import { prisma } from "@/lib/prisma";
import { getSheetsClient, getRefreshToken } from "@/lib/google";

// Bros Warehouse sheet — CHỈ ĐỌC, không bao giờ ghi vào
const BROS_SPREADSHEET_ID = "1I_IQNSq8iZPM-MqyjswYN5juJo6xadudRBU8Pwcj5WI";

/**
 * POST /api/sync/bros
 * Đọc dữ liệu từ sheet kho Bros (read-only) → lưu vào bảng WarehouseStock
 * Không ghi gì vào sheet kho Bros.
 */
export async function POST() {
  const token = await getRefreshToken();
  if (!token) {
    return Response.json(
      { error: "Chưa kết nối Google. Vào Cài đặt → Kết nối Google để lấy token." },
      { status: 400 }
    );
  }

  try {
    const sheets = await getSheetsClient();

    // Lấy danh sách tab trong Bros sheet
    const meta = await sheets.spreadsheets.get({ spreadsheetId: BROS_SPREADSHEET_ID });
    const tabTitles = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title ?? "")
      .filter(Boolean);

    // ─── 1. INVENTORY TAB → WarehouseStock ─────────────────────────────────────
    // Tìm tab Inventory (thử nhiều tên có thể)
    const inventoryTabCandidates = ["Inventory", "Current Inventory", "Stock", "Tồn kho", "inventory"];
    let inventoryTab = inventoryTabCandidates.find((t) => tabTitles.includes(t)) ?? null;

    let syncedCount = 0;
    const skippedRows: string[] = [];

    if (inventoryTab) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: BROS_SPREADSHEET_ID,
        range: `${inventoryTab}!A:Z`,
      });
      const rows = (res.data.values ?? []) as string[][];

      if (rows.length >= 2) {
        const header = rows[0].map((h) => String(h).toLowerCase().trim());

        // Tìm cột SKU — "amz barcode/ sku/ upc", "sku", "barcode", "upc", "asin"
        const skuCol = header.findIndex(
          (h) =>
            h.includes("amz barcode") ||
            h.includes("barcode") ||
            h.includes("sku") ||
            h.includes("upc") ||
            h.includes("asin")
        );

        // Tìm cột số lượng
        const colIdx = (keywords: string[]) =>
          header.findIndex((h) => keywords.some((kw) => h.includes(kw)));

        const inStockCol = colIdx(["total in stock", "in stock", "instock", "available", "qty", "quantity", "stock"]);
        const inStockNewCol = colIdx(["in stock (new)", "in stock new", "instock new", "new stock"]);
        const receivedCol = colIdx(["total received", "received"]);
        const shippedCol = colIdx(["total shipped", "shipped"]);
        const waitingCol = colIdx(["waiting", "in transit", "transit"]);
        const damagedCol = colIdx(["damaged", "damage"]);
        const descCol = colIdx(["description", "product", "title", "name", "item"]);

        if (skuCol === -1 || inStockCol === -1) {
          return Response.json(
            {
              error: `Không tìm được cột SKU hoặc cột Số lượng trong tab "${inventoryTab}". Headers: ${rows[0].join(", ")}`,
            },
            { status: 400 }
          );
        }

        const upserts: Promise<unknown>[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const sku = String(row[skuCol] ?? "").trim();
          if (!sku) {
            skippedRows.push(`Row ${i + 1}: empty SKU`);
            continue;
          }

          const parseNum = (col: number) =>
            col !== -1 ? parseFloat(String(row[col] ?? "0").replace(/,/g, "")) || 0 : 0;

          const inStock = parseNum(inStockCol);
          const inStockNew = parseNum(inStockNewCol);
          const received = parseNum(receivedCol);
          const shipped = parseNum(shippedCol);
          const waiting = parseNum(waitingCol);
          const damaged = parseNum(damagedCol);
          const description = descCol !== -1 ? String(row[descCol] ?? "").trim() : undefined;

          upserts.push(
            prisma.warehouseStock.upsert({
              where: { sku_warehouse: { sku, warehouse: "bros" } },
              update: {
                inStock,
                inStockNew,
                received,
                shipped,
                waiting,
                damaged,
                description: description || undefined,
                lastSyncedAt: new Date(),
              },
              create: {
                sku,
                warehouse: "bros",
                inStock,
                inStockNew,
                received,
                shipped,
                waiting,
                damaged,
                description: description || undefined,
                lastSyncedAt: new Date(),
              },
            })
          );
          syncedCount++;
        }

        // Chạy tất cả upserts song song (theo batch 50 để tránh quá nhiều kết nối)
        for (let i = 0; i < upserts.length; i += 50) {
          await Promise.all(upserts.slice(i, i + 50));
        }
      }
    }

    // ─── 2. Kết quả ─────────────────────────────────────────────────────────────
    const totalInDB = await prisma.warehouseStock.count({ where: { warehouse: "bros" } });

    return Response.json({
      ok: true,
      inventoryTab,
      tabsFound: tabTitles,
      syncedRows: syncedCount,
      totalInDB,
      skipped: skippedRows.length,
      skippedDetails: skippedRows.slice(0, 10),
    });
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
