/**
 * Cập nhật danh mục và tên sản phẩm
 * Chạy: node scripts/update-categories.mjs
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "dev.db");
const db = new Database(dbPath);
const now = new Date().toISOString();

let updated = 0;

const run = (sql, params = []) => {
  const result = db.prepare(sql).run(...params);
  updated += result.changes;
  return result;
};

console.log("🏷️  Cập nhật danh mục sản phẩm...\n");

// ─── 1. THẢO MỘC KHÔ (nguyên liệu mua về đóng gói) ─────────────────────────
run(`UPDATE Product SET category='Thảo mộc khô', updatedAt=? WHERE nameVi IN (
  'Bồ Công Anh', 'Xạ Đen', 'Nụ Vối', 'Trinh Nữ Hoàng Cung', 'Hạt Củ Sắn',
  'Dây Thìa Canh', 'Lá Mã Đề'
)`, [now]);

// ─── 2. TRÀ THẢO MỘC (sản phẩm đóng gói sẵn bán) ───────────────────────────
run(`UPDATE Product SET category='Trà thảo mộc', updatedAt=? WHERE nameVi IN (
  'Trà Bồ Công Anh', 'Trà Cây Cứt Lợn', 'Trà Cần Tây Sấy',
  'Trà Hoa Sen', 'Trà Khổ Qua', 'Trà Khổ Qua Sấy',
  'Trà Lá Atiso', 'Trà Lá Atiso Khô', 'Trà Lá Cần Tây',
  'Trà Lá Nguyệt Quế', 'Trà Lá Sen', 'Trà Lá Ổi',
  'Trà Nụ Hoa Hồng', 'Trà Tim Sen', 'Trà Trần Bì', 'Trà Đinh Lăng',
  'Hoa Atiso Sấy', 'Bột Cần Tây', 'Khổ Qua Sấy Khô',
  'Trần Bì Sấy'
)`, [now]);

// ─── 3. THỰC PHẨM / THẢO DƯỢC ───────────────────────────────────────────────
run(`UPDATE Product SET category='Thực phẩm & thảo dược', updatedAt=? WHERE nameVi IN (
  'Đông Trùng Hạ Thảo Sấy', 'Đông Trùng Hạ Thảo Sấy 200g',
  'Long Nhãn Sấy', 'Hạt Sen Sấy Không Hạt', 'Hạt Sen Sấy Nước Cốt Dừa',
  'Hạt Hạnh Nhân Đắng', 'Bộ Quà Trà Hoa',
  'Bộ Trà Thảo Mộc Cao Cấp', 'Bộ Trà: Atiso + TNHC + Dây Thìa Canh'
)`, [now]);

// ─── 4. HẠT GIỐNG ────────────────────────────────────────────────────────────
run(`UPDATE Product SET category='Hạt giống', updatedAt=? WHERE nameVi LIKE 'Hạt %'
  AND category IS NULL OR category NOT IN ('Thảo mộc khô','Trà thảo mộc','Thực phẩm & thảo dược')
`, [now]);
// Fix lại các hạt giống chính xác
run(`UPDATE Product SET category='Hạt giống', updatedAt=? WHERE nameVi IN (
  'Hạt Cúc Dại', 'Hạt Cải Xanh', 'Hạt Cần Tây (4 gói)',
  'Hạt Hoa Mộc Lan', 'Hạt Hồng Giòn', 'Hạt Khổ Qua (2 gói)',
  'Hạt Khổ Qua Xanh (4 gói)', 'Hạt Mướp', 'Hạt Mướp Đắng (4 gói)',
  'Hạt Nghể Đào', 'Hạt Ngò Gai', 'Hạt Rau Muống', 'Hạt Rau Má',
  'Hạt Rau Đay', 'Hạt Sen Trồng', 'Hạt Sương Sâm', 'Hạt Đậu Biếc',
  'Hạt Atiso (2 gói)', 'Hạt Củ Sắn'
)`, [now]);

// ─── 5. THỰC VẬT / TRỒNG TRỌT ───────────────────────────────────────────────
run(`UPDATE Product SET category='Thực vật', updatedAt=? WHERE nameVi IN (
  'Củ Atiso Jerusalem', 'Hạt Sen Trồng'
)`, [now]);

// ─── 6. Chuẩn hóa categories tiếng Anh thành tiếng Việt ─────────────────────
const catMap = {
  "Herbal Tea": "Trà thảo mộc",
  "Food & Beverage": "Thực phẩm",
  "Seasonal Seeds": "Hạt giống",
  "Garden": "Hạt giống",
  "Gardening": "Hạt giống",
  "Raw Material": "Nguyên liệu thô",
  "Dried Fruit": "Hoa quả khô",
  "Supplements": "Thực phẩm & thảo dược",
  "Healthcare": "Y tế & chăm sóc sức khỏe",
  "Bath & Beauty": "Làm đẹp",
  "Skincare": "Làm đẹp",
  "Bodycare": "Làm đẹp",
};

for (const [engCat, viCat] of Object.entries(catMap)) {
  run(`UPDATE Product SET category=?, updatedAt=? WHERE category=?`, [viCat, now, engCat]);
}

// ─── 7. Thống kê kết quả ─────────────────────────────────────────────────────
const withVi = db.prepare("SELECT COUNT(*) as cnt FROM Product WHERE nameVi IS NOT NULL").get();
const total = db.prepare("SELECT COUNT(*) as cnt FROM Product").get();
const cats = db.prepare(`
  SELECT category, COUNT(*) as cnt FROM Product
  WHERE category IS NOT NULL GROUP BY category ORDER BY cnt DESC LIMIT 20
`).all();

console.log(`✅ Đã cập nhật ${updated} bản ghi`);
console.log(`\n📊 Sản phẩm có tên VN: ${withVi.cnt} / ${total.cnt}`);
console.log("\n📂 Danh mục sau cập nhật:");
for (const c of cats) {
  console.log(`  ${c.category}: ${c.cnt} sản phẩm`);
}

// ─── 8. Gợi ý sản phẩm cần thêm tên VN (thảo mộc/trà chưa có) ────────────────
const needVi = db.prepare(`
  SELECT name, skuShopify FROM Product
  WHERE nameVi IS NULL
  AND (name LIKE '%herb%' OR name LIKE '%tea%' OR name LIKE '%dried%'
    OR name LIKE '%lotus%' OR name LIKE '%artichoke%' OR name LIKE '%bitter%'
    OR name LIKE '%celery%' OR name LIKE '%dandelion%' OR name LIKE '%ginger%'
    OR name LIKE '%turmeric%' OR name LIKE '%moringa%' OR name LIKE '%noni%')
  COLLATE NOCASE
  ORDER BY name
  LIMIT 20
`).all();

if (needVi.length > 0) {
  console.log("\n⚠️  Sản phẩm thảo mộc/trà chưa có tên VN:");
  for (const p of needVi) {
    console.log(`  ${p.skuShopify} | ${p.name.substring(0, 70)}`);
  }
}

db.close();
