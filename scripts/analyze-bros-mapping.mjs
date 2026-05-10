/**
 * Phân tích toàn bộ sản phẩm kho Bros → match với sản phẩm trong DB (Shopify)
 * Xuất: console table + CSV
 *
 * Dùng: node scripts/analyze-bros-mapping.mjs
 */

import Database from "better-sqlite3";
import { google } from "googleapis";
import { createWriteStream } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ──────────────────────────────────────────
// Config
// ──────────────────────────────────────────
const BROS_SPREADSHEET_ID = "1I_IQNSq8iZPM-MqyjswYN5juJo6xadudRBU8Pwcj5WI";

// ──────────────────────────────────────────
// Google Sheets setup
// ──────────────────────────────────────────
function getOAuth() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ──────────────────────────────────────────
// Normalize tên để so sánh
// ──────────────────────────────────────────
function norm(raw = "") {
  return raw
    .toLowerCase()
    .replace(/^\d[\d\s.]*\s*(x\s*\d+)?\s*(gram|g|kg|oz|lb|pack|packs|pcs|pieces?|count)\s*/i, "")
    .replace(/\s*[\|\-]\s*.*/g, "")      // bỏ phần sau | hoặc -
    .replace(/\b\d+\s*(gram|g|kg|oz)\b/gi, "") // bỏ trọng lượng giữa câu
    .replace(/[®™©,().]/g, "")
    .replace(/\b(for|and|the|of|in|with|natural|organic|pure|fresh|dried|bulk)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Từ không có giá trị phân biệt trong tên hạt giống
const STOP_WORDS = new Set([
  "seeds","seed","for","planting","plant","plants","growing","grow","garden","gardening",
  "and","the","of","in","with","natural","organic","pure","fresh","dried","bulk",
  "pack","packs","pcs","count","pieces","piece","easy","non","gmo","heirloom",
  "flower","flowers","tree","trees","herb","herbs","from","into","your","own",
  "home","garden","beautiful","colorful","vibrant","fast","growing"
]);

function normWords(s) {
  return norm(s)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

/** Tính điểm tương đồng dựa trên từ có nghĩa (bỏ stop words và số) */
function wordSimilarity(a, b) {
  const wa = new Set(normWords(a));
  const wb = new Set(normWords(b));
  if (wa.size === 0 || wb.size === 0) return 0;
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  // Jaccard similarity: intersection / union
  const union = new Set([...wa, ...wb]).size;
  return common / union;
}

// ──────────────────────────────────────────
// Main
// ──────────────────────────────────────────
async function main() {
  // 1. Đọc DB products
  const db = new Database(join(ROOT, "dev.db"));
  const dbProducts = db.prepare(`
    SELECT id, name, nameVi, skuShopify, skuAmz, category, gramsPerUnit
    FROM Product
    ORDER BY nameVi ASC, name ASC
  `).all();
  db.close();

  console.log(`\n📦 DB products: ${dbProducts.length}`);

  // 2. Kết nối Google Sheets, lấy refresh token từ DB
  const db2 = new Database(join(ROOT, "dev.db"));
  const tokenRow = db2.prepare("SELECT value FROM Setting WHERE key='googleRefreshToken'").get();
  db2.close();

  if (!tokenRow?.value) {
    console.error("❌ Chưa có Google refresh token trong DB. Vào app → Cài đặt → Kết nối Google.");
    process.exit(1);
  }

  const auth = getOAuth();
  auth.setCredentials({ refresh_token: tokenRow.value });
  const sheets = google.sheets({ version: "v4", auth });

  // 3. Lấy danh sách tab Bros sheet
  const meta = await sheets.spreadsheets.get({ spreadsheetId: BROS_SPREADSHEET_ID });
  const tabs = meta.data.sheets.map((s) => s.properties.title);
  console.log(`📋 Bros sheet tabs: ${tabs.join(", ")}`);

  const inventoryTab = ["Inventory", "Current Inventory", "Stock", "inventory"].find((t) => tabs.includes(t));
  if (!inventoryTab) {
    console.error(`❌ Không tìm thấy tab Inventory. Tabs: ${tabs.join(", ")}`);
    process.exit(1);
  }

  // 4. Đọc dữ liệu Bros sheet
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: BROS_SPREADSHEET_ID,
    range: `${inventoryTab}!A:Z`,
  });

  const rows = res.data.values ?? [];
  if (rows.length < 2) { console.error("❌ Sheet trống"); process.exit(1); }

  const header = rows[0].map((h) => String(h).toLowerCase().trim());
  console.log(`\n📊 Bros headers: ${rows[0].join(" | ")}`);

  // Tìm cột
  const colIdx = (kws) => header.findIndex((h) => kws.some((kw) => h.includes(kw)));
  const skuCol   = colIdx(["amz barcode", "barcode", "sku", "upc", "asin"]);
  // Ưu tiên "description" trước, rồi mới "title/name/product"
  const nameCol  = colIdx(["description"]) !== -1
    ? colIdx(["description"])
    : colIdx(["title", "name", "product", "item"]);
  const qtyCol   = colIdx(["total in stock"]) !== -1
    ? colIdx(["total in stock"])
    : colIdx(["in stock", "instock", "available", "qty", "quantity", "stock"]);

  console.log(`   SKU col: ${skuCol !== -1 ? rows[0][skuCol] : "❌ không tìm thấy"}`);
  console.log(`   Name col: ${nameCol !== -1 ? rows[0][nameCol] : "❌ không tìm thấy"}`);
  console.log(`   Qty col: ${qtyCol !== -1 ? rows[0][qtyCol] : "❌ không tìm thấy"}`);

  if (qtyCol === -1) { console.error("❌ Không tìm thấy cột qty"); process.exit(1); }

  // Parse Bros rows
  const brosItems = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sku  = skuCol  !== -1 ? String(row[skuCol]  ?? "").trim() : "";
    const name = nameCol !== -1 ? String(row[nameCol] ?? "").trim() : "";
    const qty  = parseFloat(String(row[qtyCol] ?? "0").replace(/,/g, "")) || 0;
    if (!sku && !name) continue;
    brosItems.push({ sku, name, qty });
  }

  console.log(`\n🏭 Bros items: ${brosItems.length}`);
  console.log(`   Có tên: ${brosItems.filter((b) => b.name).length}`);
  console.log(`   Có SKU: ${brosItems.filter((b) => b.sku).length}`);
  console.log(`   Có cả hai: ${brosItems.filter((b) => b.name && b.sku).length}`);

  // 5. Build name map từ DB products
  const dbBySkuAmz  = new Map(dbProducts.filter((p) => p.skuAmz).map((p) => [p.skuAmz, p]));
  const dbBySku     = new Map(dbProducts.filter((p) => p.skuShopify).map((p) => [p.skuShopify, p]));
  const dbByNormVi  = new Map(dbProducts.filter((p) => p.nameVi).map((p) => [norm(p.nameVi), p]));
  const dbByNormEn  = new Map(dbProducts.map((p) => [norm(p.name), p]));

  // 6. Match từng Bros item
  const results = [];
  for (const bro of brosItems) {
    let matched = null;
    let matchType = "none";
    let score = 0;

    // Priority 1: SKU AMZ exact
    if (bro.sku && dbBySkuAmz.has(bro.sku)) {
      matched = dbBySkuAmz.get(bro.sku);
      matchType = "sku_amz";
      score = 1.0;
    }
    // Priority 2: SKU Shopify exact (nếu Bros dùng Shopify SKU)
    else if (bro.sku && dbBySku.has(bro.sku)) {
      matched = dbBySku.get(bro.sku);
      matchType = "sku_shopify";
      score = 1.0;
    }
    // Priority 3: Tên VN exact (normalized)
    else if (bro.name) {
      const normBro = norm(bro.name);
      if (dbByNormVi.has(normBro)) {
        matched = dbByNormVi.get(normBro);
        matchType = "name_vi_exact";
        score = 1.0;
      }
      // Priority 4: Tên EN exact (normalized)
      else if (dbByNormEn.has(normBro)) {
        matched = dbByNormEn.get(normBro);
        matchType = "name_en_exact";
        score = 1.0;
      }
      // Priority 5: Fuzzy name match (chọn best match > 0.55, Jaccard trên từ có nghĩa)
      else {
        let bestScore = 0.55; // ngưỡng tối thiểu chặt hơn
        let bestProduct = null;
        for (const p of dbProducts) {
          const s1 = wordSimilarity(bro.name, p.name);
          const s2 = p.nameVi ? wordSimilarity(bro.name, p.nameVi) : 0;
          const s = Math.max(s1, s2);
          if (s > bestScore) {
            bestScore = s;
            bestProduct = p;
          }
        }
        if (bestProduct) {
          matched = bestProduct;
          matchType = "fuzzy";
          score = bestScore;
        }
      }
    }

    results.push({
      brosName: bro.name,
      brosSku: bro.sku,
      brosQty: bro.qty,
      matchType,
      score: Math.round(score * 100),
      dbId: matched?.id ?? "",
      dbName: matched?.name ?? "",
      dbNameVi: matched?.nameVi ?? "",
      dbSku: matched?.skuShopify ?? "",
      dbCategory: matched?.category ?? "",
    });
  }

  // 7. Thống kê
  const matched     = results.filter((r) => r.matchType !== "none");
  const unmatched   = results.filter((r) => r.matchType === "none");
  const skuMatch    = results.filter((r) => r.matchType.startsWith("sku"));
  const nameExact   = results.filter((r) => r.matchType.includes("exact"));
  const fuzzyMatch  = results.filter((r) => r.matchType === "fuzzy");

  console.log("\n" + "═".repeat(70));
  console.log("📊 KẾT QUẢ MATCHING");
  console.log("═".repeat(70));
  console.log(`  Tổng Bros items:      ${brosItems.length}`);
  console.log(`  ✅ Khớp được:         ${matched.length} (${Math.round(matched.length/brosItems.length*100)}%)`);
  console.log(`     └ SKU exact:       ${skuMatch.length}`);
  console.log(`     └ Tên exact:       ${nameExact.length}`);
  console.log(`     └ Fuzzy (>45%):   ${fuzzyMatch.length}`);
  console.log(`  ❌ Không khớp:        ${unmatched.length} — cần tạo mới hoặc nhập qty thủ công`);
  console.log("═".repeat(70));

  // 8. In bảng sản phẩm không khớp
  if (unmatched.length > 0) {
    console.log("\n⚠️  SẢN PHẨM CHỈ CÓ TRONG KHO BROS (chưa có trên Shopify):");
    console.log("─".repeat(70));
    for (const r of unmatched.sort((a, b) => b.brosQty - a.brosQty)) {
      const qtyTag = r.brosQty > 0 ? `[Qty: ${r.brosQty}]` : "[Qty: 0]";
      console.log(`  ${qtyTag.padEnd(12)} ${r.brosName || "(no name)"} ${r.brosSku ? `| SKU: ${r.brosSku}` : ""}`);
    }
  }

  // 9. In bảng fuzzy match để review
  if (fuzzyMatch.length > 0) {
    console.log("\n🔍 FUZZY MATCHES — CẦN KIỂM TRA LẠI:");
    console.log("─".repeat(70));
    for (const r of fuzzyMatch.sort((a, b) => b.score - a.score)) {
      console.log(`  [${r.score}%] "${r.brosName.substring(0, 45)}" → "${(r.dbNameVi || r.dbName).substring(0, 45)}"`);
    }
  }

  // 10. Cập nhật skuAmz vào DB cho các sản phẩm đã khớp chắc chắn
  const db3 = new Database(join(ROOT, "dev.db"));
  const updateSku = db3.prepare("UPDATE Product SET skuAmz=?, updatedAt=? WHERE id=?");
  const now = new Date().toISOString();
  let skuUpdated = 0;
  for (const r of results) {
    // Chỉ update khi có match chắc (exact hoặc fuzzy >= 67%) VÀ có cả ASIN lẫn DB product
    if (r.matchType !== "none" && r.score >= 67 && r.brosSku && r.dbId) {
      updateSku.run(r.brosSku, now, r.dbId);
      skuUpdated++;
    }
  }
  db3.close();
  console.log(`\n✅ Đã cập nhật skuAmz cho ${skuUpdated} sản phẩm trong DB`);

  // 11. Xuất CSV
  const csvPath = join(ROOT, "bros-mapping-analysis.csv");
  const csv = createWriteStream(csvPath);
  csv.write("Bros Name,Bros SKU,Bros Qty,Match Type,Score %,DB Name EN,DB Name VN,DB Shopify SKU,DB Category\n");
  for (const r of results) {
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    csv.write([
      esc(r.brosName), esc(r.brosSku), r.brosQty,
      r.matchType, r.score,
      esc(r.dbName), esc(r.dbNameVi), esc(r.dbSku), esc(r.dbCategory),
    ].join(",") + "\n");
  }
  csv.end(() => console.log(`\n💾 Đã xuất CSV: ${csvPath}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
