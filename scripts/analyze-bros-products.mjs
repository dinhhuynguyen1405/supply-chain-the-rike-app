/**
 * Đọc sheet kho Bros và phân tích sản phẩm → map với sản phẩm trong app
 * Chạy: node scripts/analyze-bros-products.mjs
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "dev.db");
const db = new Database(dbPath);

console.log("📊 Phân tích sản phẩm trong app...\n");

// Lấy tất cả sản phẩm
const products = db.prepare(`
  SELECT id, name, nameVi, skuShopify, skuAmz, unit, gramsPerUnit, category
  FROM Product
  ORDER BY nameVi ASC, name ASC
`).all();

// Thống kê
const withVi = products.filter(p => p.nameVi);
const withShopifySkU = products.filter(p => p.skuShopify);
const withAmzSku = products.filter(p => p.skuAmz);
const withCategory = products.filter(p => p.category);
const herbs = products.filter(p => p.unit === 'kg' || (p.nameVi && ['Trà', 'Hạt', 'Bột', 'Long', 'Nụ', 'Đông', 'Lá', 'Ngó', 'Hoa', 'Củ', 'Dây'].some(kw => p.nameVi?.startsWith(kw))));

console.log("=== THỐNG KÊ ===");
console.log(`Tổng: ${products.length} sản phẩm`);
console.log(`Có tên VN: ${withVi.length} (${Math.round(withVi.length/products.length*100)}%)`);
console.log(`Có SKU Shopify: ${withShopifySkU.length}`);
console.log(`Có SKU AMZ: ${withAmzSku.length}`);
console.log(`Có danh mục: ${withCategory.length}`);
console.log(`Sản phẩm thảo mộc/trà: ${herbs.length}`);

console.log("\n=== CÁC SẢN PHẨM THẢO MỘC ĐÃ CÓ TÊN VN ===");
for (const p of withVi) {
  if (!herbs.includes(p)) continue;
  console.log(`  ${p.nameVi} | ${p.skuShopify || p.skuAmz || '—'} | unit=${p.unit} g/gói=${p.gramsPerUnit || '—'}`);
}

console.log("\n=== SẢN PHẨM KG (MUA VỀ ĐÓNG GÓI) ===");
const kgProducts = products.filter(p => p.unit === 'kg');
for (const p of kgProducts) {
  console.log(`  ${p.nameVi ?? p.name.substring(0,50)} | skuAmz=${p.skuAmz || '—'} | g/gói=${p.gramsPerUnit || '—'}`);
}

console.log("\n=== THIẾU TÊN VN (có SKU shopify) ===");
const missingViWithSku = products.filter(p => !p.nameVi && p.skuShopify);
for (const p of missingViWithSku.slice(0, 30)) {
  console.log(`  SKU: ${p.skuShopify} | ${p.name.substring(0, 60)}`);
}

console.log("\n=== DANH MỤC HIỆN TẠI ===");
const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
categories.sort();
for (const c of categories) {
  const count = products.filter(p => p.category === c).length;
  console.log(`  ${c}: ${count} sản phẩm`);
}

db.close();
