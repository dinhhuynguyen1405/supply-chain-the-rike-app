-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'to_supplier',
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "paidAt" DATETIME NOT NULL,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "createdAt", "currency", "id", "method", "notes", "paidAt", "purchaseOrderId") SELECT "amount", "createdAt", "currency", "id", "method", "notes", "paidAt", "purchaseOrderId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE TABLE "new_PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderDate" DATETIME NOT NULL,
    "expectedDate" DATETIME,
    "arrivedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "shippingCode" TEXT,
    "shippingUnit" TEXT,
    "notes" TEXT,
    "totalVnd" REAL NOT NULL DEFAULT 0,
    "sellingPriceVnd" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PurchaseOrder" ("arrivedDate", "code", "createdAt", "expectedDate", "id", "notes", "orderDate", "shippingCode", "shippingUnit", "status", "supplierId", "totalVnd", "updatedAt") SELECT "arrivedDate", "code", "createdAt", "expectedDate", "id", "notes", "orderDate", "shippingCode", "shippingUnit", "status", "supplierId", "totalVnd", "updatedAt" FROM "PurchaseOrder";
DROP TABLE "PurchaseOrder";
ALTER TABLE "new_PurchaseOrder" RENAME TO "PurchaseOrder";
CREATE UNIQUE INDEX "PurchaseOrder_code_key" ON "PurchaseOrder"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
