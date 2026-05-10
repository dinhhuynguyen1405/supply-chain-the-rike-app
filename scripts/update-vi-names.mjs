/**
 * Cập nhật tên tiếng Việt cho các sản phẩm thảo mộc / trà
 * Chạy: node scripts/update-vi-names.mjs
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "dev.db");
const db = new Database(dbPath);

const now = new Date().toISOString();

// Danh sách cập nhật: [id, nameVi, gramsPerUnit (nếu cần cập nhật)]
const updates = [
  // ─── Trà & thảo mộc khô ────────────────────────────────────────────────────
  ["cmnzwnrm00011ahvqivhdequ6", "Trà Lá Nguyệt Quế", 100, "gói"],      // 100 gram Bay Leaf Tea
  ["cmnzwnrm10012ahvqkhnldfh7", "Bột Cần Tây", 100, "gói"],             // 100 Gram Celery Powder
  ["cmnzwnrm30014ahvqpz7qmhvy", "Đông Trùng Hạ Thảo Sấy", 100, "gói"], // 100 gram Dried Mushroom Cordyceps
  ["cmnzwnrm50016ahvq94wzki06", "Trà Lá Atiso", 100, "gói"],            // 100 gram Organic Artichoke Leaf Tea
  ["cmnzwnrm20013ahvqhyy0lgdm", "Trà Đinh Lăng", 100, "gói"],           // 100 gram dried Ming Aralia Tea
  ["cmnzwnrmy001xahvqfgymlys6", "Trà Tim Sen", 100, "gói"],             // 100-gram Dried Lotus Embryo Tea
  ["cmnzwnrmw001wahvqfuk12qjd", "Trà Lá Ổi", 100, "gói"],              // 100-gram Dried guava tea leaves
  ["cmnzwnrmz001yahvqfrprxfbp", "Trà Trần Bì", 100, "gói"],            // 100-gram Orange Peel Tea
  ["cmnzwnrn0001zahvq4ss8pt9k", "Hạt Hạnh Nhân Đắng", 100, "gói"],    // 100-gram Bitter Raw Apricot Seeds
  ["cmnzwnrno002aahvqxof2rt4t", "Hoa Atiso Sấy", 100, "gói"],          // 100g Dried Artichoke Flower buds
  ["cmo1245ha006ptnvqai5yejqi", "Đông Trùng Hạ Thảo Sấy", 100, "gói"], // Authentic Dried Cordyceps Militaris
  ["cmo1245i2007gtnvq2v0paj6e", "Hạt Sen Sấy Nước Cốt Dừa", 150, "gói"], // Freeze-Dried Lotus Seeds
  ["cmo1245ia007rtnvq9w4g28st", "Trà Lá Cần Tây", 100, "gói"],         // Celery Leaf Tea
  ["cmo1245jm009dtnvqjyj7l6ts", "Khổ Qua Sấy Khô", 300, "gói"],       // Dehydrated Bitter Melon 300g
  ["cmo1245jn009etnvqpkkshck8", "Trà Khổ Qua", 100, "gói"],            // Dehydrated Bitter Melon Tea 100g
  ["cmo1245jn009ftnvqbrn2pxn4", "Trà Cần Tây Sấy", 100, "gói"],       // Dehydrated Celery Leaf Tea
  ["cmo1245jy009rtnvqjp2istai", "Trà Lá Atiso Khô", 100, "gói"],      // Dried Artichoke Leaves Tea
  ["cmo1245kc00a4tnvqdh03k5pe", "Trà Hoa Sen", 100, "gói"],            // Dried Lotus Flower Tea
  ["cmo1245kc00a5tnvqvu4yppxq", "Ngó Sen Sấy", 115, "gói"],            // Dried Lotus Root Slices
  ["cmo1245kf00a9tnvqe4kn7q52", "Trần Bì Sấy", 100, "gói"],           // Dried Organic Tangerine Orange Peel
  ["cmo1245k1009vtnvqyj12jkaa", "Trà Bồ Công Anh", 100, "gói"],       // Dried dandelion tea 100g x 2 pack
  ["cmo1245lh00bhtnvqyp3d5h8s", "Trà Bồ Công Anh", 100, "gói"],       // Floral Dandelion Tea
  ["cmo1245li00bitnvqwerzxmp5", "Bộ Quà Trà Hoa", null, "gói"],        // Flower Tea Gift Set
  ["cmo1245n600ddtnvqjhov3kry", "Bộ Trà Thảo Mộc Cao Cấp", null, "gói"], // Herbal Tea Gift Set
  ["cmo1245n700detnvq66y50szm", "Bộ Trà: Atiso + TNHC + Dây Thìa Canh", null, "gói"], // Herbal Tea Gift Set
  ["cmo1245o100e7tnvqfoal13jg", "Trà Lá Sen", 100, "gói"],             // Lotus Leaf Tea
  ["cmo1245q100eutnvqq5au2mpi", "Đông Trùng Hạ Thảo Sấy 200g", 200, "gói"], // Cordyceps 200g
  ["cmo1245kb00a3tnvq6qysbauz", "Long Nhãn Sấy", 200, "gói"],          // Dried Longan fruit
  ["cmo1245o200e8tnvqb0kj4enk", "Hạt Sen Sấy Không Hạt", 150, "gói"], // Dried Coreless White Lotus Seeds
  ["cmo1245el003ptnvq1uefc3ux", "Hạt Sen Trồng", null, "pack"],        // Lotus Seeds for Planting

  // ─── Hạt giống ─────────────────────────────────────────────────────────────
  ["cmo1245ce0019tnvqhsjsljk6", "Hạt Khổ Qua (2 gói)", null, "pack"],  // Bitter Melon Seeds 2 pack
  ["cmo1245fo004xtnvq3xtmbjpi", "Hạt Khổ Qua Xanh (4 gói)", null, "pack"], // Green Skin Bitter Melon Seeds
  ["cmo1245hq0075tnvq5ywqb19q", "Hạt Mướp Đắng (4 gói)", null, "pack"], // Bitter Melon Seeds 4 pack
  ["cmo1245ib007stnvqzow6hl4h", "Hạt Cần Tây (4 gói)", null, "pack"],  // Celery Seeds 4 pack
  ["cmo1245mf00cgtnvqrsy1e7fb", "Hạt Atiso (2 gói)", null, "pack"],    // Green Globe Artichoke Seeds
  ["cmo1245r200frtnvqewxgtb6b", "Củ Atiso Jerusalem", null, "pack"],   // Jerusalem Artichoke Tubers
];

let updated = 0;
let skipped = 0;

for (const [id, nameVi, gramsPerUnit, unit] of updates) {
  const existing = db.prepare("SELECT id, name FROM Product WHERE id=?").get(id);
  if (!existing) {
    console.log(`⚠️  Không tìm thấy: ${id}`);
    skipped++;
    continue;
  }

  const updateFields = gramsPerUnit
    ? `nameVi=?, gramsPerUnit=?, unit=?, updatedAt=?`
    : `nameVi=?, unit=?, updatedAt=?`;

  if (gramsPerUnit) {
    db.prepare(`UPDATE Product SET ${updateFields} WHERE id=?`).run(nameVi, gramsPerUnit, unit, now, id);
  } else {
    db.prepare(`UPDATE Product SET ${updateFields} WHERE id=?`).run(nameVi, unit, now, id);
  }

  console.log(`✅ ${nameVi}  ←  ${existing.name.substring(0, 60)}${existing.name.length > 60 ? "..." : ""}`);
  updated++;
}

// ─── Cập nhật thêm: các sản phẩm trong bộ trà tặng ──────────────────────────
// Xác định Gymnema Sylvestre (Dây Thìa Canh)
const gymnasmaProducts = db.prepare("SELECT id, name FROM Product WHERE name LIKE '%Gymnema%' COLLATE NOCASE").all();
for (const p of gymnasmaProducts) {
  if (!p.name.includes("Seeds")) {
    db.prepare("UPDATE Product SET nameVi=?, updatedAt=? WHERE id=?").run("Dây Thìa Canh", now, p.id);
    console.log(`✅ Dây Thìa Canh  ←  ${p.name.substring(0, 60)}`);
    updated++;
  }
}

// Plantain leaf = Lá Mã Đề
const plantainProducts = db.prepare("SELECT id, name FROM Product WHERE name LIKE '%Plantain%' COLLATE NOCASE").all();
for (const p of plantainProducts) {
  if (p.name.toLowerCase().includes("leaf") || p.name.toLowerCase().includes("tea")) {
    db.prepare("UPDATE Product SET nameVi=?, updatedAt=? WHERE id=?").run("Lá Mã Đề", now, p.id);
    console.log(`✅ Lá Mã Đề  ←  ${p.name.substring(0, 60)}`);
    updated++;
  }
}

// Crinum Latifolium / Trinh Nữ Hoàng Cung — check if there are separate Shopify entries
const crinumProducts = db.prepare("SELECT id, name FROM Product WHERE name LIKE '%Crinum%' OR name LIKE '%TNHC%' COLLATE NOCASE").all();
for (const p of crinumProducts) {
  db.prepare("UPDATE Product SET nameVi=?, updatedAt=? WHERE id=?").run("Trinh Nữ Hoàng Cung", now, p.id);
  console.log(`✅ Trinh Nữ Hoàng Cung  ←  ${p.name.substring(0, 60)}`);
  updated++;
}

console.log(`\n🎉 Đã cập nhật ${updated} sản phẩm, bỏ qua ${skipped} sản phẩm không tìm thấy.`);

// Xem tổng kết
const withViName = db.prepare("SELECT COUNT(*) as cnt FROM Product WHERE nameVi IS NOT NULL AND nameVi != ''").get();
const total = db.prepare("SELECT COUNT(*) as cnt FROM Product").get();
console.log(`📊 Sản phẩm có tên VN: ${withViName.cnt} / ${total.cnt}`);

db.close();
