/**
 * scripts/export-sqlite.mjs
 * Export toàn bộ data từ SQLite → sqlite-export.json
 * Dùng sqlite3 CLI (có sẵn trên macOS/Linux) — không cần native bindings
 *
 * Chạy TRƯỚC khi đổi sang PostgreSQL:
 *   node scripts/export-sqlite.mjs
 */
import { execSync } from "child_process";
import { writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir   = join(__dirname, "..");
const dbPath    = join(rootDir, "dev.db");
const outPath   = join(__dirname, "sqlite-export.json");

if (!existsSync(dbPath)) {
  console.error(`❌ Không tìm thấy file DB: ${dbPath}`);
  process.exit(1);
}

const TABLES = [
  "Supplier", "Setting", "Product",
  "PurchaseOrder", "PurchaseItem", "Payment",
  "ShipmentBatch", "ShipmentBatchOrder", "FundTransaction",
  "FulfillmentOrder", "FulfillmentItem",
  "ShopifyOrder", "SalesBatch", "SalesItem",
  "PurchaseResearch", "PurchaseResearchPrice",
  "ProductionOrder", "ProductionCost", "ProductionItem",
  "WarehouseStock", "BrosFee", "ProductImage",
];

const exported = {};
let totalRows = 0;

for (const table of TABLES) {
  try {
    // sqlite3 CLI với mode json
    const json = execSync(
      `sqlite3 "${dbPath}" -json "SELECT * FROM \\"${table}\\""`,
      { maxBuffer: 50 * 1024 * 1024 }
    ).toString().trim();

    const rows = json ? JSON.parse(json) : [];
    exported[table] = rows;
    totalRows += rows.length;
    console.log(`  ✓ ${table.padEnd(28)} ${rows.length} rows`);
  } catch (e) {
    console.warn(`  ⚠ ${table}: ${e.message.slice(0, 80)}`);
    exported[table] = [];
  }
}

writeFileSync(outPath, JSON.stringify(exported, null, 2), "utf-8");

console.log(`\n✅ Export xong — ${totalRows} rows từ ${TABLES.length} bảng`);
console.log(`   → ${outPath}`);
console.log(`\nBước tiếp:`);
console.log(`  1. docker compose up -d        (nếu chưa chạy)`);
console.log(`  2. npx prisma migrate dev --name init`);
console.log(`  3. node scripts/import-to-postgres.mjs`);
