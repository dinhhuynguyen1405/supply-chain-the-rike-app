/**
 * Seed script: Đơn mua hàng ngày 14/04/2026
 * Chạy từ thư mục gốc dự án: node scripts/seed-purchase-apr2026.mjs
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "dev.db");
const db = new Database(dbPath);

// Generate a random CUID-like unique ID
const genId = () => crypto.randomBytes(12).toString("hex");

const now = new Date().toISOString();
const orderDate = "2026-04-14 00:00:00";

console.log("🌱 Bắt đầu seed dữ liệu đơn mua 14/04/2026...\n");

// ─── 1. Tạo nhà cung cấp nếu chưa có ──────────────────────────────────────────
let supplier = db.prepare("SELECT id, name FROM Supplier WHERE name LIKE '%đầu mối%' LIMIT 1").get();
if (!supplier) {
  const supplierId = genId();
  db.prepare(`
    INSERT INTO Supplier (id, name, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    supplierId,
    "Chợ đầu mối / Địa phương",
    "Mua trực tiếp tại chợ đầu mối hoặc người bán địa phương",
    now, now
  );
  supplier = { id: supplierId, name: "Chợ đầu mối / Địa phương" };
  console.log("✅ Tạo nhà cung cấp:", supplier.name);
} else {
  console.log("⏭️  Nhà cung cấp đã có:", supplier.name);
}

// ─── 2. Cập nhật gramsPerUnit = 200 cho các sản phẩm thảo mộc ─────────────────
const productUpdates = [
  { id: "cmnzeg4rh000fztvq2vtsntvg", nameVi: "Bồ Công Anh", gramsPerUnit: 200 },
  { id: "cmnzeg4rh000gztvqy1gfuo3b", nameVi: "Trinh Nữ Hoàng Cung", gramsPerUnit: 200 },
  { id: "cmnzeg4rh000hztvqorrhnjzo", nameVi: "Xạ Đen", gramsPerUnit: 200 },
  { id: "cmnzeg4rh000iztvq7jvx1eab", nameVi: "Nụ Vối", gramsPerUnit: 200 },
];

for (const p of productUpdates) {
  const existing = db.prepare("SELECT id, gramsPerUnit FROM Product WHERE id=?").get(p.id);
  if (existing) {
    db.prepare("UPDATE Product SET gramsPerUnit=?, updatedAt=? WHERE id=?").run(p.gramsPerUnit, now, p.id);
    console.log(`✅ Cập nhật ${p.nameVi}: gramsPerUnit = ${p.gramsPerUnit}g`);
  } else {
    console.log(`⚠️  Không tìm thấy sản phẩm ${p.nameVi} (id=${p.id})`);
  }
}

// ─── 3. Tạo / cập nhật sản phẩm Hạt Củ Sắn ────────────────────────────────────
let hatCuSan = db.prepare(`
  SELECT id, name FROM Product
  WHERE nameVi LIKE '%Củ Sắn%' OR name LIKE '%Jicama%' OR name LIKE '%jicama%'
  LIMIT 1
`).get();

if (hatCuSan) {
  db.prepare(`
    UPDATE Product SET nameVi='Hạt Củ Sắn', unit='kg', gramsPerUnit=200,
    notes='150 hạt/gói, 200g/gói. Lưu ý: bóc vỏ trước khi ăn.', updatedAt=? WHERE id=?
  `).run(now, hatCuSan.id);
  console.log(`✅ Cập nhật sản phẩm Hạt Củ Sắn (id: ${hatCuSan.id})`);
} else {
  const newId = genId();
  db.prepare(`
    INSERT INTO Product (id, name, nameVi, unit, gramsPerUnit, restockThreshold, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    "Jicama Seeds (Hạt Củ Sắn) - 200g pack",
    "Hạt Củ Sắn",
    "kg", 200, 5,
    "150 hạt/gói, 200g/gói. Lưu ý: bóc vỏ trước khi ăn.",
    now, now
  );
  hatCuSan = { id: newId };
  console.log(`✅ Tạo mới sản phẩm Hạt Củ Sắn (id: ${newId})`);
}

// ─── 4. Kiểm tra đơn hàng đã tồn tại chưa ─────────────────────────────────────
const purchaseCode = "PO-20260414-001";
const existingOrder = db.prepare("SELECT id FROM PurchaseOrder WHERE code=?").get(purchaseCode);

if (existingOrder) {
  console.log(`\n⏭️  Đơn hàng ${purchaseCode} đã tồn tại. Không tạo lại.`);
  db.close();
  process.exit(0);
}

// ─── 5. Tạo đơn mua hàng ────────────────────────────────────────────────────────
const items = [
  {
    productId: "cmnzeg4rh000fztvq2vtsntvg",
    nameVi: "Bồ Công Anh",
    quantity: 3,
    priceVnd: 170000,
    notes: "Giá dao động 150-250k/kg tùy đợt",
  },
  {
    productId: "cmnzeg4rh000gztvqy1gfuo3b",
    nameVi: "Trinh Nữ Hoàng Cung",
    quantity: 3,
    priceVnd: 250000,
    notes: "Hàng Loại 2, deal từ 270k xuống 250k",
  },
  {
    productId: "cmnzeg4rh000hztvqorrhnjzo",
    nameVi: "Xạ Đen",
    quantity: 5,
    priceVnd: 150000,
    notes: "Hàng Loại 1",
  },
  {
    productId: "cmnzeg4rh000iztvq7jvx1eab",
    nameVi: "Nụ Vối",
    quantity: 3,
    priceVnd: 190000,
    notes: "Hàng Loại 1, deal từ 200k xuống 190k",
  },
  {
    productId: hatCuSan.id,
    nameVi: "Hạt Củ Sắn",
    quantity: 5,
    priceVnd: 1000000,
    notes: "5kg = 5,000,000 VND. 150 hạt/gói, đóng 200g/gói.",
  },
];

const totalVnd = items.reduce((sum, item) => sum + item.quantity * item.priceVnd, 0);
console.log(`\n📦 Tổng giá trị đơn hàng: ${totalVnd.toLocaleString("vi-VN")} VND`);

const orderId = genId();
db.prepare(`
  INSERT INTO PurchaseOrder (id, code, supplierId, orderDate, arrivedDate, status, totalVnd, notes, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  orderId,
  purchaseCode,
  supplier.id,
  orderDate,
  orderDate,
  "arrived",
  totalVnd,
  "Mua 14/04/2026. Đang đóng gói 200g/gói tại nhà. Đã thanh toán đủ.",
  now, now
);
console.log(`✅ Tạo đơn mua hàng: ${purchaseCode}`);

for (const item of items) {
  const itemId = genId();
  db.prepare(`
    INSERT INTO PurchaseItem (id, purchaseOrderId, productId, quantity, priceVnd, subtotalVnd, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    itemId, orderId, item.productId,
    item.quantity, item.priceVnd,
    item.quantity * item.priceVnd,
    item.notes
  );
  console.log(`  ✅ ${item.nameVi}: ${item.quantity}kg × ${item.priceVnd.toLocaleString("vi-VN")}đ = ${(item.quantity * item.priceVnd).toLocaleString("vi-VN")}đ`);
}

// Thanh toán
const paymentId = genId();
db.prepare(`
  INSERT INTO Payment (id, purchaseOrderId, direction, amount, currency, paidAt, method, notes, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  paymentId, orderId, "to_supplier", totalVnd, "VND",
  orderDate, "Tiền mặt",
  "Đã thanh toán đủ cho người bán ngày 14/04/2026",
  now
);
console.log(`\n✅ Ghi nhận thanh toán: ${totalVnd.toLocaleString("vi-VN")} VND → người bán`);

// ─── 6. Ghi nhận quỹ ─────────────────────────────────────────────────────────
db.prepare(`
  INSERT INTO FundTransaction (id, date, type, amountVnd, description, createdAt)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(
  genId(), orderDate, "nhung_in", totalVnd,
  "Nhung gửi tiền mua hàng đợt 14/04: BCĂ 3kg + TNHC 3kg + XĐ 5kg + NV 3kg + HCS 5kg",
  now
);
console.log(`✅ Ghi nhận: Nhung gửi ${totalVnd.toLocaleString("vi-VN")} VND vào quỹ`);

db.prepare(`
  INSERT INTO FundTransaction (id, date, type, amountVnd, description, purchaseOrderId, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  genId(), orderDate, "spent", totalVnd,
  `Chi mua hàng đơn ${purchaseCode}`,
  orderId, now
);
console.log(`✅ Ghi nhận: Chi ${totalVnd.toLocaleString("vi-VN")} VND mua hàng`);

console.log(`
🎉 Hoàn tất!

📊 Tóm tắt đơn ${purchaseCode}:
  - Ngày: 14/04/2026  |  Trạng thái: arrived (đang đóng gói tại nhà)
  - Tổng tiền: ${totalVnd.toLocaleString("vi-VN")} VND

${items.map(i => `  • ${i.nameVi}: ${i.quantity}kg × ${i.priceVnd.toLocaleString("vi-VN")}đ = ${(i.quantity * i.priceVnd).toLocaleString("vi-VN")}đ`).join("\n")}
`);

db.close();
