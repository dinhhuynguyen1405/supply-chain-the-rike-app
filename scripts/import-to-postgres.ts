/**
 * scripts/import-to-postgres.ts
 * Import data từ sqlite-export.json → PostgreSQL
 *
 * Chạy: npx tsx scripts/import-to-postgres.ts
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const inPath = join(__dirname, "sqlite-export.json");
// __dirname không có trong ESM — dùng path.resolve
const data = JSON.parse(
  readFileSync(join(process.cwd(), "scripts", "sqlite-export.json"), "utf-8")
);

function toDate(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(val as string);
  return isNaN(d.getTime()) ? null : d;
}
function toFloat(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(val as string);
  return isNaN(n) ? null : n;
}
function toInt(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseInt(val as string, 10);
  return isNaN(n) ? null : n;
}
function toBool(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  return val === 1 || val === "1" || val === "true";
}

let totalInserted = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchInsert(label: string, rows: any[], insertFn: (r: any) => Promise<unknown>) {
  if (!rows?.length) { console.log(`  — ${label.padEnd(28)} (0 rows)`); return; }
  const BATCH = 100;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await Promise.all(rows.slice(i, i + BATCH).map(insertFn));
    count += rows.slice(i, i + BATCH).length;
  }
  totalInserted += count;
  console.log(`  ✓ ${label.padEnd(28)} ${count} rows`);
}

async function run() {
  console.log("🚀 Bắt đầu import vào PostgreSQL...\n");

  await batchInsert("Supplier", data.Supplier, (r) =>
    prisma.supplier.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, name: r.name, phone: r.phone ?? null, location: r.location ?? null,
      notes: r.notes ?? null, createdAt: toDate(r.createdAt) ?? new Date(), updatedAt: toDate(r.updatedAt) ?? new Date(),
    }})
  );

  await batchInsert("Setting", data.Setting, (r) =>
    prisma.setting.upsert({ where: { key: r.key }, update: { value: r.value, updatedAt: toDate(r.updatedAt) ?? new Date() }, create: {
      key: r.key, value: r.value, updatedAt: toDate(r.updatedAt) ?? new Date(),
    }})
  );

  await batchInsert("Product", data.Product, (r) =>
    prisma.product.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, name: r.name, nameVi: r.nameVi ?? null, skuShopify: r.skuShopify ?? null,
      skuTiktok: r.skuTiktok ?? null, skuAmz: r.skuAmz ?? null, skuBros: r.skuBros ?? null,
      unit: r.unit ?? "kg", gramsPerUnit: toFloat(r.gramsPerUnit), piecesPerUnit: toFloat(r.piecesPerUnit),
      piecesPerPack: toFloat(r.piecesPerPack), restockThreshold: toFloat(r.restockThreshold) ?? 10,
      nhungQty: toFloat(r.nhungQty) ?? 0, category: r.category ?? null, notes: r.notes ?? null,
      imageUrl: r.imageUrl ?? null, priceUsd: toFloat(r.priceUsd),
      labelImageUrl: r.labelImageUrl ?? null, labelDriveUrl: r.labelDriveUrl ?? null,
      createdAt: toDate(r.createdAt) ?? new Date(), updatedAt: toDate(r.updatedAt) ?? new Date(),
    }})
  );

  await batchInsert("PurchaseOrder", data.PurchaseOrder, (r) =>
    prisma.purchaseOrder.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, code: r.code, supplierId: r.supplierId,
      orderDate: toDate(r.orderDate) ?? new Date(), expectedDate: toDate(r.expectedDate),
      arrivedDate: toDate(r.arrivedDate), status: r.status ?? "draft",
      shippingCode: r.shippingCode ?? null, shippingUnit: r.shippingUnit ?? null, notes: r.notes ?? null,
      totalVnd: toFloat(r.totalVnd) ?? 0, shippingCostVnd: toFloat(r.shippingCostVnd),
      packingLaborVnd: toFloat(r.packingLaborVnd), packingStatus: r.packingStatus ?? null,
      purchaseType: r.purchaseType ?? "raw_material", purchaseDestination: r.purchaseDestination ?? "kho_huy",
      isBuyOnBehalf: toBool(r.isBuyOnBehalf), sellingPriceVnd: toFloat(r.sellingPriceVnd),
      createdAt: toDate(r.createdAt) ?? new Date(), updatedAt: toDate(r.updatedAt) ?? new Date(),
    }})
  );

  await batchInsert("PurchaseItem", data.PurchaseItem, (r) =>
    prisma.purchaseItem.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, purchaseOrderId: r.purchaseOrderId, productId: r.productId,
      quantity: toFloat(r.quantity) ?? 0, priceVnd: toFloat(r.priceVnd) ?? 0,
      subtotalVnd: toFloat(r.subtotalVnd) ?? 0, notes: r.notes ?? null,
    }})
  );

  await batchInsert("Payment", data.Payment, (r) =>
    prisma.payment.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, purchaseOrderId: r.purchaseOrderId, direction: r.direction ?? "to_supplier",
      amount: toFloat(r.amount) ?? 0, currency: r.currency ?? "VND",
      paidAt: toDate(r.paidAt) ?? new Date(), method: r.method ?? null, notes: r.notes ?? null,
      createdAt: toDate(r.createdAt) ?? new Date(),
    }})
  );

  await batchInsert("ShipmentBatch", data.ShipmentBatch, (r) =>
    prisma.shipmentBatch.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, code: r.code, description: r.description ?? null, carrier: r.carrier ?? null,
      trackingCode: r.trackingCode ?? null, packedDate: toDate(r.packedDate),
      departedVnDate: toDate(r.departedVnDate), arrivedUsDate: toDate(r.arrivedUsDate),
      receivedByTdDate: toDate(r.receivedByTdDate), status: r.status ?? "packing",
      tdSheetUpdated: toBool(r.tdSheetUpdated), totalWeightKg: toFloat(r.totalWeightKg),
      shippingCostVnd: toFloat(r.shippingCostVnd), destinationWarehouse: r.destinationWarehouse ?? "nhung",
      autoUpdateInventory: toBool(r.autoUpdateInventory ?? true), inventoryUpdated: toBool(r.inventoryUpdated),
      notes: r.notes ?? null, createdAt: toDate(r.createdAt) ?? new Date(), updatedAt: toDate(r.updatedAt) ?? new Date(),
    }})
  );

  await batchInsert("ShipmentBatchOrder", data.ShipmentBatchOrder, (r) =>
    prisma.shipmentBatchOrder.upsert({
      where: { shipmentBatchId_purchaseOrderId: { shipmentBatchId: r.shipmentBatchId, purchaseOrderId: r.purchaseOrderId } },
      update: {}, create: { shipmentBatchId: r.shipmentBatchId, purchaseOrderId: r.purchaseOrderId },
    })
  );

  await batchInsert("FundTransaction", data.FundTransaction, (r) =>
    prisma.fundTransaction.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, date: toDate(r.date) ?? new Date(), type: r.type,
      amountVnd: toFloat(r.amountVnd) ?? 0, description: r.description ?? null,
      purchaseOrderId: r.purchaseOrderId ?? null, createdAt: toDate(r.createdAt) ?? new Date(),
    }})
  );

  await batchInsert("FulfillmentOrder", data.FulfillmentOrder, (r) =>
    prisma.fulfillmentOrder.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, code: r.code, source: r.source, shopifyOrderId: r.shopifyOrderId ?? null,
      tiktokOrderId: r.tiktokOrderId ?? null, customerName: r.customerName ?? null,
      customerAddress: r.customerAddress ?? null, customerNote: r.customerNote ?? null,
      status: r.status ?? "pending", warehouseSource: r.warehouseSource ?? null,
      nhungNotifiedAt: toDate(r.nhungNotifiedAt), nhungShippedAt: toDate(r.nhungShippedAt),
      nhungTrackingCode: r.nhungTrackingCode ?? null, brosNotifiedAt: toDate(r.brosNotifiedAt),
      brosShippedAt: toDate(r.brosShippedAt), brosTrackingCode: r.brosTrackingCode ?? null,
      sentToTdAt: toDate(r.sentToTdAt), packedAt: toDate(r.packedAt), shippedAt: toDate(r.shippedAt),
      trackingCode: r.trackingCode ?? null, notes: r.notes ?? null, noteSentToTd: r.noteSentToTd ?? null,
      tdSheetRowId: r.tdSheetRowId ?? null, tdSheetSynced: toBool(r.tdSheetSynced),
      createdAt: toDate(r.createdAt) ?? new Date(), updatedAt: toDate(r.updatedAt) ?? new Date(),
    }})
  );

  await batchInsert("FulfillmentItem", data.FulfillmentItem, (r) =>
    prisma.fulfillmentItem.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, fulfillmentOrderId: r.fulfillmentOrderId, productId: r.productId ?? null,
      skuRaw: r.skuRaw ?? null, productName: r.productName,
      quantity: toFloat(r.quantity) ?? 0, warehouseSource: r.warehouseSource ?? null, notes: r.notes ?? null,
    }})
  );

  await batchInsert("ShopifyOrder", data.ShopifyOrder, (r) =>
    prisma.shopifyOrder.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, shopifyId: r.shopifyId, orderName: r.orderName, email: r.email ?? null,
      financialStatus: r.financialStatus ?? null, fulfillmentStatus: r.fulfillmentStatus ?? null,
      totalPriceUsd: toFloat(r.totalPriceUsd) ?? 0, lineItemsJson: r.lineItemsJson ?? "[]",
      sourceName: r.sourceName ?? null, paymentGateway: r.paymentGateway ?? null,
      createdAtShopify: toDate(r.createdAtShopify) ?? new Date(), syncedAt: toDate(r.syncedAt) ?? new Date(),
      fulfillmentOrderId: r.fulfillmentOrderId ?? null,
    }})
  );

  await batchInsert("SalesBatch", data.SalesBatch, (r) =>
    prisma.salesBatch.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, source: r.source, importedAt: toDate(r.importedAt) ?? new Date(),
      fileName: r.fileName ?? null, dateFrom: toDate(r.dateFrom), dateTo: toDate(r.dateTo), notes: r.notes ?? null,
    }})
  );

  await batchInsert("SalesItem", data.SalesItem, (r) =>
    prisma.salesItem.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, batchId: r.batchId, productId: r.productId ?? null, purchaseItemId: r.purchaseItemId ?? null,
      skuRaw: r.skuRaw ?? null, productName: r.productName, quantity: toFloat(r.quantity) ?? 0,
      priceUsd: toFloat(r.priceUsd) ?? 0, subtotalUsd: toFloat(r.subtotalUsd) ?? 0,
      orderId: r.orderId ?? null, orderDate: toDate(r.orderDate), createdAt: toDate(r.createdAt) ?? new Date(),
    }})
  );

  await batchInsert("PurchaseResearch", data.PurchaseResearch, (r) =>
    prisma.purchaseResearch.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, productId: r.productId ?? null, productName: r.productName, unit: r.unit ?? "kg",
      minPriceVnd: toFloat(r.minPriceVnd), maxPriceVnd: toFloat(r.maxPriceVnd),
      targetPriceVnd: toFloat(r.targetPriceVnd), targetQty: toFloat(r.targetQty),
      priority: toInt(r.priority) ?? 2, status: r.status ?? "researching",
      qualityNotes: r.qualityNotes ?? null, sourceNotes: r.sourceNotes ?? null, generalNotes: r.generalNotes ?? null,
      createdAt: toDate(r.createdAt) ?? new Date(), updatedAt: toDate(r.updatedAt) ?? new Date(),
    }})
  );

  await batchInsert("PurchaseResearchPrice", data.PurchaseResearchPrice, (r) =>
    prisma.purchaseResearchPrice.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, researchId: r.researchId, supplierName: r.supplierName ?? null,
      priceVnd: toFloat(r.priceVnd) ?? 0, unit: r.unit ?? "kg", quality: r.quality ?? null,
      isVerified: toBool(r.isVerified), date: toDate(r.date) ?? new Date(), notes: r.notes ?? null,
    }})
  );

  await batchInsert("ProductionOrder", data.ProductionOrder, (r) =>
    prisma.productionOrder.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, code: r.code, purchaseOrderId: r.purchaseOrderId, status: r.status ?? "pending",
      startedAt: toDate(r.startedAt), completedAt: toDate(r.completedAt), notes: r.notes ?? null,
      createdAt: toDate(r.createdAt) ?? new Date(), updatedAt: toDate(r.updatedAt) ?? new Date(),
    }})
  );

  await batchInsert("ProductionCost", data.ProductionCost, (r) =>
    prisma.productionCost.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, productionOrderId: r.productionOrderId, type: r.type, description: r.description,
      amountVnd: toFloat(r.amountVnd) ?? 0, note: r.note ?? null,
      purchaseOrderId: r.purchaseOrderId ?? null, createdAt: toDate(r.createdAt) ?? new Date(),
    }})
  );

  await batchInsert("ProductionItem", data.ProductionItem, (r) =>
    prisma.productionItem.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, productionOrderId: r.productionOrderId, purchaseItemId: r.purchaseItemId, productId: r.productId,
      plannedQty: toFloat(r.plannedQty) ?? 0, actualQty: toFloat(r.actualQty),
      gramsPerPack: toFloat(r.gramsPerPack), piecesPerUnit: toFloat(r.piecesPerUnit),
      piecesPerPack: toFloat(r.piecesPerPack), wasteNote: r.wasteNote ?? null,
      createdAt: toDate(r.createdAt) ?? new Date(),
    }})
  );

  await batchInsert("WarehouseStock", data.WarehouseStock, (r) =>
    prisma.warehouseStock.upsert({
      where: { sku_warehouse: { sku: r.sku, warehouse: r.warehouse } }, update: {},
      create: {
        id: r.id, sku: r.sku, warehouse: r.warehouse, description: r.description ?? null,
        inStock: toFloat(r.inStock) ?? 0, inStockNew: toFloat(r.inStockNew) ?? 0,
        received: toFloat(r.received) ?? 0, shipped: toFloat(r.shipped) ?? 0,
        waiting: toFloat(r.waiting) ?? 0, damaged: toFloat(r.damaged) ?? 0,
        unit: r.unit ?? null, lastSyncedAt: toDate(r.lastSyncedAt) ?? new Date(),
      },
    })
  );

  await batchInsert("BrosFee", data.BrosFee, (r) =>
    prisma.brosFee.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, type: r.type, description: r.description, amountUsd: toFloat(r.amountUsd) ?? 0,
      amountVnd: toFloat(r.amountVnd), shipmentBatchId: r.shipmentBatchId ?? null,
      fulfillmentOrderId: r.fulfillmentOrderId ?? null, sku: r.sku ?? null,
      quantity: toFloat(r.quantity), paidAt: toDate(r.paidAt), note: r.note ?? null,
      createdAt: toDate(r.createdAt) ?? new Date(),
    }})
  );

  await batchInsert("ProductImage", data.ProductImage, (r) =>
    prisma.productImage.upsert({ where: { id: r.id }, update: {}, create: {
      id: r.id, productId: r.productId, url: r.url, type: r.type ?? "listing",
      altText: r.altText ?? null, sortOrder: toInt(r.sortOrder) ?? 0,
      driveUrl: r.driveUrl ?? null, sizeBytes: toInt(r.sizeBytes),
      createdAt: toDate(r.createdAt) ?? new Date(),
    }})
  );

  console.log(`\n✅ Import xong — ${totalInserted} rows tổng cộng`);
  console.log("\nKiểm tra:");
  console.log(`  Products:       ${await prisma.product.count()}`);
  console.log(`  PurchaseOrders: ${await prisma.purchaseOrder.count()}`);
  console.log(`  ShopifyOrders:  ${await prisma.shopifyOrder.count()}`);
  console.log(`  FulfillOrders:  ${await prisma.fulfillmentOrder.count()}`);
  console.log(`  Settings:       ${await prisma.setting.count()}`);
}

run()
  .catch((e) => { console.error("\n❌ Lỗi:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
