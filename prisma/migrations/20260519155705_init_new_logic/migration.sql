/*
  Warnings:

  - You are about to drop the column `tdSheetUpdated` on the `ShipmentBatch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PurchaseItem" ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "investor" TEXT NOT NULL DEFAULT 'huy';

-- AlterTable
ALTER TABLE "ShipmentBatch" DROP COLUMN "tdSheetUpdated",
ADD COLUMN     "estimatedRateUsdPerKg" DOUBLE PRECISION DEFAULT 14,
ADD COLUMN     "shippingCostHcmUs" DOUBLE PRECISION,
ADD COLUMN     "shippingCostVnHcm" DOUBLE PRECISION,
ADD COLUMN     "statusHcmUs" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "statusVnHcm" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "trackingVnHcm" TEXT;

-- CreateTable
CREATE TABLE "SalesRefund" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "orderName" TEXT,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "refundedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatingCost" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT,
    "amountUsd" DOUBLE PRECISION,
    "amountVnd" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatingCost_pkey" PRIMARY KEY ("id")
);
