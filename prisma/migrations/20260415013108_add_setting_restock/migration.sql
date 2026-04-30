-- AlterTable
ALTER TABLE "Product" ADD COLUMN "restockThreshold" REAL DEFAULT 10;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
