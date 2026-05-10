-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameVi" TEXT,
    "skuShopify" TEXT,
    "skuTiktok" TEXT,
    "skuAmz" TEXT,
    "skuBros" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "gramsPerUnit" DOUBLE PRECISION,
    "piecesPerUnit" DOUBLE PRECISION,
    "piecesPerPack" DOUBLE PRECISION,
    "restockThreshold" DOUBLE PRECISION DEFAULT 10,
    "nhungQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "category" TEXT,
    "notes" TEXT,
    "imageUrl" TEXT,
    "priceUsd" DOUBLE PRECISION,
    "labelImageUrl" TEXT,
    "labelDriveUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'listing',
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "driveUrl" TEXT,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3),
    "arrivedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "shippingCode" TEXT,
    "shippingUnit" TEXT,
    "notes" TEXT,
    "totalVnd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shippingCostVnd" DOUBLE PRECISION,
    "packingLaborVnd" DOUBLE PRECISION,
    "packingStatus" TEXT,
    "purchaseType" TEXT NOT NULL DEFAULT 'raw_material',
    "purchaseDestination" TEXT NOT NULL DEFAULT 'kho_huy',
    "isBuyOnBehalf" BOOLEAN NOT NULL DEFAULT false,
    "sellingPriceVnd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "priceVnd" DOUBLE PRECISION NOT NULL,
    "subtotalVnd" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'to_supplier',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentBatch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "carrier" TEXT,
    "trackingCode" TEXT,
    "packedDate" TIMESTAMP(3),
    "departedVnDate" TIMESTAMP(3),
    "arrivedUsDate" TIMESTAMP(3),
    "receivedByTdDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'packing',
    "tdSheetUpdated" BOOLEAN NOT NULL DEFAULT false,
    "totalWeightKg" DOUBLE PRECISION,
    "shippingCostVnd" DOUBLE PRECISION,
    "destinationWarehouse" TEXT NOT NULL DEFAULT 'nhung',
    "autoUpdateInventory" BOOLEAN NOT NULL DEFAULT true,
    "inventoryUpdated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentBatchOrder" (
    "shipmentBatchId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,

    CONSTRAINT "ShipmentBatchOrder_pkey" PRIMARY KEY ("shipmentBatchId","purchaseOrderId")
);

-- CreateTable
CREATE TABLE "FundTransaction" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "amountVnd" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "tiktokOrderId" TEXT,
    "customerName" TEXT,
    "customerAddress" TEXT,
    "customerNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "warehouseSource" TEXT,
    "nhungNotifiedAt" TIMESTAMP(3),
    "nhungShippedAt" TIMESTAMP(3),
    "nhungTrackingCode" TEXT,
    "brosNotifiedAt" TIMESTAMP(3),
    "brosShippedAt" TIMESTAMP(3),
    "brosTrackingCode" TEXT,
    "sentToTdAt" TIMESTAMP(3),
    "packedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "trackingCode" TEXT,
    "notes" TEXT,
    "noteSentToTd" TEXT,
    "tdSheetRowId" TEXT,
    "tdSheetSynced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FulfillmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FulfillmentItem" (
    "id" TEXT NOT NULL,
    "fulfillmentOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "skuRaw" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "warehouseSource" TEXT,
    "notes" TEXT,

    CONSTRAINT "FulfillmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseStock" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL,
    "description" TEXT,
    "inStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inStockNew" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "received" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipped" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waiting" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "damaged" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopifyOrder" (
    "id" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "orderName" TEXT NOT NULL,
    "email" TEXT,
    "financialStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "totalPriceUsd" DOUBLE PRECISION NOT NULL,
    "lineItemsJson" TEXT NOT NULL,
    "sourceName" TEXT,
    "paymentGateway" TEXT,
    "createdAtShopify" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfillmentOrderId" TEXT,

    CONSTRAINT "ShopifyOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesBatch" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "SalesBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesItem" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "productId" TEXT,
    "purchaseItemId" TEXT,
    "skuRaw" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "subtotalUsd" DOUBLE PRECISION NOT NULL,
    "orderId" TEXT,
    "orderDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseResearch" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "minPriceVnd" DOUBLE PRECISION,
    "maxPriceVnd" DOUBLE PRECISION,
    "targetPriceVnd" DOUBLE PRECISION,
    "targetQty" DOUBLE PRECISION,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'researching',
    "qualityNotes" TEXT,
    "sourceNotes" TEXT,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseResearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseResearchPrice" (
    "id" TEXT NOT NULL,
    "researchId" TEXT NOT NULL,
    "supplierName" TEXT,
    "priceVnd" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "quality" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "PurchaseResearchPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCost" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountVnd" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "purchaseOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionItem" (
    "id" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "plannedQty" DOUBLE PRECISION NOT NULL,
    "actualQty" DOUBLE PRECISION,
    "gramsPerPack" DOUBLE PRECISION,
    "piecesPerUnit" DOUBLE PRECISION,
    "piecesPerPack" DOUBLE PRECISION,
    "wasteNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrosFee" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "amountVnd" DOUBLE PRECISION,
    "shipmentBatchId" TEXT,
    "fulfillmentOrderId" TEXT,
    "sku" TEXT,
    "quantity" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrosFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_code_key" ON "PurchaseOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentBatch_code_key" ON "ShipmentBatch"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentOrder_code_key" ON "FulfillmentOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseStock_sku_warehouse_key" ON "WarehouseStock"("sku", "warehouse");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyOrder_shopifyId_key" ON "ShopifyOrder"("shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_code_key" ON "ProductionOrder"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_purchaseOrderId_key" ON "ProductionOrder"("purchaseOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionItem_purchaseItemId_key" ON "ProductionItem"("purchaseItemId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentBatchOrder" ADD CONSTRAINT "ShipmentBatchOrder_shipmentBatchId_fkey" FOREIGN KEY ("shipmentBatchId") REFERENCES "ShipmentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentBatchOrder" ADD CONSTRAINT "ShipmentBatchOrder_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundTransaction" ADD CONSTRAINT "FundTransaction_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_fulfillmentOrderId_fkey" FOREIGN KEY ("fulfillmentOrderId") REFERENCES "FulfillmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FulfillmentItem" ADD CONSTRAINT "FulfillmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesItem" ADD CONSTRAINT "SalesItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "SalesBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesItem" ADD CONSTRAINT "SalesItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesItem" ADD CONSTRAINT "SalesItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseResearch" ADD CONSTRAINT "PurchaseResearch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseResearchPrice" ADD CONSTRAINT "PurchaseResearchPrice_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "PurchaseResearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCost" ADD CONSTRAINT "ProductionCost_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionItem" ADD CONSTRAINT "ProductionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
