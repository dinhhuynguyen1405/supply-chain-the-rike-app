import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../dev.db");

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: dbPath }),
});

const products = [
  { name: "Culantro Seeds (2 pack x 4000)", nameVi: "Hạt Ngò Gai", skuShopify: "6799964558ros", skuTiktok: "6799964558ros", unit: "pack", category: "Hạt giống" },
  { name: "Saluyot Seeds (2 pack x 3000)", nameVi: "Hạt Rau Đay", skuShopify: "25264673", skuTiktok: "25264673", unit: "pack", category: "Hạt giống" },
  { name: "Luffa Sponge Gourd Seeds (3 pack x 40)", nameVi: "Hạt Mướp", skuShopify: "POEEDCCV - NEW", skuTiktok: "POEEDCCV - NEW", unit: "pack", category: "Hạt giống" },
  { name: "Baby Mustard Seeds (3 pack x 1500)", nameVi: "Hạt Cải Xanh", skuShopify: "A7-PZNY-57AQ", skuTiktok: "A7-PZNY-57AQ", unit: "pack", category: "Hạt giống" },
  { name: "Rose Bud Tea (100g)", nameVi: "Trà Nụ Hoa Hồng", skuShopify: "IO-TQ8T-PEHE", skuTiktok: "IO-TQ8T-PEHE", unit: "gói", category: "Trà thảo mộc", gramsPerUnit: 100 },
  { name: "Daisy Fleabane Seeds (3 pack x 1000)", nameVi: "Hạt Cúc Dại", skuShopify: "Daisy fleabane-Nhat", skuTiktok: "Daisy fleabane-Nhat", unit: "pack", category: "Hạt giống" },
  { name: "Gotu Kola Seeds (4 pack x 500)", nameVi: "Hạt Rau Má", skuShopify: "UWYEDCJD - NEW", skuTiktok: "UWYEDCJD - NEW", unit: "pack", category: "Hạt giống" },
  { name: "Lady's Thumb Weed Seeds (4 pack x 500)", nameVi: "Hạt Nghể Đào", skuShopify: "WSEDRFTG-NEW", skuTiktok: "WSEDRFTG-NEW", unit: "pack", category: "Hạt giống" },
  { name: "Ageratum Tea (100g)", nameVi: "Trà Cây Cứt Lợn", skuShopify: "CX-MUA8-SU19", skuTiktok: "CX-MUA8-SU19", unit: "gói", category: "Trà thảo mộc", gramsPerUnit: 100 },
  { name: "Water Spinach Seeds (2 pack x 1000)", nameVi: "Hạt Rau Muống", skuShopify: "WSSSUHYG-NEW 2", skuTiktok: "WSSSUHYG-NEW 2", unit: "pack", category: "Hạt giống" },
  { name: "Butterfly Pea Flower Seeds (2 pack x 100)", nameVi: "Hạt Đậu Biếc", skuShopify: "TYDEYDER -NEW", skuTiktok: "TYDEYDER -NEW", unit: "pack", category: "Hạt giống" },
  { name: "Green Grass Jelly Seeds (4 pack x 70)", nameVi: "Hạt Sương Sâm", skuShopify: "IHYHTGRF-NEW", skuTiktok: "IHYHTGRF-NEW", unit: "pack", category: "Hạt giống" },
  { name: "Eastern Persimmon Seeds (3 pack x 10)", nameVi: "Hạt Hồng Giòn", skuShopify: "HGYTHFND-NEW", skuTiktok: "HGYTHFND-NEW", unit: "pack", category: "Hạt giống" },
  { name: "Bitter Melon Tea Dehydrated (100g)", nameVi: "Trà Khổ Qua Sấy", skuShopify: "LC-LBH4-VFU4", skuTiktok: "LC-LBH4-VFU4", unit: "gói", category: "Trà thảo mộc", gramsPerUnit: 100 },
  { name: "Magnolia Seeds (2 pack x 10)", nameVi: "Hạt Hoa Mộc Lan", skuShopify: "UUJFUU-NEW", skuTiktok: "UUJFUU-NEW", unit: "pack", category: "Hạt giống" },
  { name: "Bồ Công Anh (Dandelion)", nameVi: "Bồ Công Anh", skuShopify: null, skuTiktok: null, unit: "kg", category: "Thảo mộc", gramsPerUnit: 150, restockThreshold: 5 },
  { name: "Trinh Nữ Hoàng Cung", nameVi: "Trinh Nữ Hoàng Cung", skuShopify: null, skuTiktok: null, unit: "kg", category: "Thảo mộc", gramsPerUnit: 200, restockThreshold: 5 },
  { name: "Xạ Đen", nameVi: "Xạ Đen", skuShopify: null, skuTiktok: null, unit: "kg", category: "Thảo mộc", gramsPerUnit: 200, restockThreshold: 5 },
  { name: "Nụ Vối", nameVi: "Nụ Vối", skuShopify: null, skuTiktok: null, unit: "kg", category: "Thảo mộc", gramsPerUnit: 100, restockThreshold: 5 },
];

const suppliers = [
  { name: "Vườn Thảo Mộc Miền Bắc", phone: "0912 345 678", location: "Hà Nội, Việt Nam", notes: "Cung cấp các loại thảo mộc khô" },
  { name: "Nông Trại Rau Sạch Đà Lạt", phone: "0908 123 456", location: "Đà Lạt, Lâm Đồng", notes: "Cung cấp hạt giống rau củ" },
  { name: "Hợp Tác Xã Hoa Hồng Đà Lạt", phone: "0933 456 789", location: "Đà Lạt, Lâm Đồng", notes: "Chuyên nụ hoa hồng và trà hoa" },
];

async function main() {
  console.log("🌱 Seeding...");

  await prisma.salesItem.deleteMany();
  await prisma.salesBatch.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.product.deleteMany();
  await prisma.setting.deleteMany();

  const createdProducts = await Promise.all(products.map((p) => prisma.product.create({ data: p })));
  const createdSuppliers = await Promise.all(suppliers.map((s) => prisma.supplier.create({ data: s })));

  await prisma.setting.create({ data: { key: "usdToVnd", value: "25500" } });

  console.log(`✓ ${createdProducts.length} products, ${createdSuppliers.length} suppliers, 1 setting`);

  const nameViMap: Record<string, string> = Object.fromEntries(createdProducts.map((p) => [p.nameVi!, p.id]));
  const [s1id, s2id, s3id] = createdSuppliers.map((s) => s.id);

  // PO1: Thảo mộc tháng 4 (confirmed, partially paid) — mua hộ
  await prisma.purchaseOrder.create({
    data: {
      code: "PO260414-001",
      supplierId: s1id,
      isBuyOnBehalf: true,
      sellingPriceVnd: 3000000,
      orderDate: new Date("2026-04-14"),
      expectedDate: new Date("2026-04-20"),
      status: "confirmed",
      notes: "Đợt thảo mộc tháng 4 - Hà Nội (mua hộ)",
      totalVnd: 2580000,
      items: {
        create: [
          { productId: nameViMap["Bồ Công Anh"], quantity: 3, priceVnd: 170000, subtotalVnd: 510000, notes: "Giá giao động từ 150 - 250 tuỳ đợt hàng" },
          { productId: nameViMap["Trinh Nữ Hoàng Cung"], quantity: 3, priceVnd: 250000, subtotalVnd: 750000, notes: "Hàng Loại 2, 270k đã deal còn 250k" },
          { productId: nameViMap["Xạ Đen"], quantity: 5, priceVnd: 150000, subtotalVnd: 750000, notes: "Hàng Loại 1" },
          { productId: nameViMap["Nụ Vối"], quantity: 3, priceVnd: 190000, subtotalVnd: 570000, notes: "Hàng Loại 1, 200k đã deal còn 190k" },
        ],
      },
      payments: {
        create: [
          { direction: "to_supplier", amount: 1000000, currency: "VND", paidAt: new Date("2026-04-14"), method: "Chuyển khoản", notes: "Cọc 50%" },
        ],
      },
    },
  });

  // PO2: Hạt giống tháng 3 (completed, fully paid)
  await prisma.purchaseOrder.create({
    data: {
      code: "PO260320-002",
      supplierId: s2id,
      orderDate: new Date("2026-03-20"),
      expectedDate: new Date("2026-03-27"),
      arrivedDate: new Date("2026-03-26"),
      status: "completed",
      shippingCode: "FEDEX9823741",
      shippingUnit: "FedEx",
      notes: "Hạt giống lô 1 tháng 3",
      totalVnd: 4500000,
      items: {
        create: [
          { productId: nameViMap["Hạt Ngò Gai"], quantity: 50, priceVnd: 45000, subtotalVnd: 2250000 },
          { productId: nameViMap["Hạt Rau Đay"], quantity: 30, priceVnd: 55000, subtotalVnd: 1650000 },
          { productId: nameViMap["Hạt Rau Muống"], quantity: 20, priceVnd: 30000, subtotalVnd: 600000 },
        ],
      },
      payments: {
        create: [
          { direction: "to_supplier", amount: 2000000, currency: "VND", paidAt: new Date("2026-03-20"), method: "Chuyển khoản", notes: "Cọc" },
          { direction: "to_supplier", amount: 2500000, currency: "VND", paidAt: new Date("2026-03-27"), method: "Chuyển khoản", notes: "Thanh lý" },
        ],
      },
    },
  });

  // PO3: Trà hoa (shipping, partially paid)
  await prisma.purchaseOrder.create({
    data: {
      code: "PO260401-003",
      supplierId: s3id,
      orderDate: new Date("2026-04-01"),
      expectedDate: new Date("2026-04-12"),
      status: "shipping",
      shippingCode: "DHL7291038",
      shippingUnit: "DHL",
      notes: "Trà hoa hồng + ageratum lô 1",
      totalVnd: 3200000,
      items: {
        create: [
          { productId: nameViMap["Trà Nụ Hoa Hồng"], quantity: 20, priceVnd: 120000, subtotalVnd: 2400000 },
          { productId: nameViMap["Trà Cây Cứt Lợn"], quantity: 8, priceVnd: 100000, subtotalVnd: 800000 },
        ],
      },
      payments: {
        create: [
          { direction: "to_supplier", amount: 1500000, currency: "VND", paidAt: new Date("2026-04-01"), method: "Chuyển khoản", notes: "Cọc 50%" },
        ],
      },
    },
  });

  console.log("✓ 3 purchase orders created");

  // Sales batch từ TikTok (orders_export.csv)
  const skuMap: Record<string, string> = Object.fromEntries(
    createdProducts.filter((p) => p.skuShopify).map((p) => [p.skuShopify!, p.id])
  );

  const salesItems = [
    { productName: "2 pack x Mexican Coriander Herb 4000 Culantro Seeds", skuRaw: "6799964558ros", quantity: 37, priceUsd: 8.5, subtotalUsd: 314.5, orderDate: new Date("2026-03-23") },
    { productName: "2 pack x 3000 Saluyot Seeds (Egyptian Spinach)", skuRaw: "25264673", quantity: 3, priceUsd: 9.0, subtotalUsd: 27.0, orderDate: new Date("2026-03-24") },
    { productName: "Luffa Sponge Gourd Seeds 3 pack x 40", skuRaw: "POEEDCCV - NEW", quantity: 2, priceUsd: 9.0, subtotalUsd: 18.0, orderDate: new Date("2026-03-24") },
    { productName: "Baby Mustard Seeds 3 pack x 1500", skuRaw: "A7-PZNY-57AQ", quantity: 1, priceUsd: 8.0, subtotalUsd: 8.0, orderDate: new Date("2026-03-25") },
    { productName: "Rose Bud Tea 100 gram", skuRaw: "IO-TQ8T-PEHE", quantity: 2, priceUsd: 14.99, subtotalUsd: 29.98, orderDate: new Date("2026-03-27") },
    { productName: "Daisy Fleabane Seeds 3 pack x 1000", skuRaw: "Daisy fleabane-Nhat", quantity: 1, priceUsd: 7.5, subtotalUsd: 7.5, orderDate: new Date("2026-03-28") },
    { productName: "Gotu Kola Seeds 4 pack x 500", skuRaw: "UWYEDCJD - NEW", quantity: 1, priceUsd: 9.99, subtotalUsd: 9.99, orderDate: new Date("2026-03-29") },
    { productName: "Lady's Thumb Weed Seeds 4 pack x 500", skuRaw: "WSEDRFTG-NEW", quantity: 1, priceUsd: 8.0, subtotalUsd: 8.0, orderDate: new Date("2026-03-30") },
    { productName: "Ageratum Tea 100g", skuRaw: "CX-MUA8-SU19", quantity: 1, priceUsd: 12.99, subtotalUsd: 12.99, orderDate: new Date("2026-04-01") },
    { productName: "Water Spinach Seeds 2 pack x 1000", skuRaw: "WSSSUHYG-NEW 2", quantity: 1, priceUsd: 7.0, subtotalUsd: 7.0, orderDate: new Date("2026-04-02") },
    { productName: "Butterfly Pea Flower Seeds 2 pack x 100", skuRaw: "TYDEYDER -NEW", quantity: 1, priceUsd: 8.5, subtotalUsd: 8.5, orderDate: new Date("2026-04-03") },
    { productName: "Bitter Melon Tea Dehydrated 100g", skuRaw: "LC-LBH4-VFU4", quantity: 1, priceUsd: 13.99, subtotalUsd: 13.99, orderDate: new Date("2026-04-05") },
    { productName: "Magnolia Seeds 2 pack x 10", skuRaw: "UUJFUU-NEW", quantity: 1, priceUsd: 6.5, subtotalUsd: 6.5, orderDate: new Date("2026-04-06") },
  ];

  await prisma.salesBatch.create({
    data: {
      source: "tiktok",
      fileName: "orders_export.csv",
      dateFrom: new Date("2026-03-23"),
      dateTo: new Date("2026-04-06"),
      notes: "TikTok Shop — Tháng 3-4/2026 (50 orders, 52 line items)",
      items: {
        create: salesItems.map((i) => ({
          ...i,
          productId: skuMap[i.skuRaw] ?? null,
        })),
      },
    },
  });

  console.log(`✓ Sales batch: ${salesItems.length} items`);
  console.log("✅ Done!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
