-- AlterEnum: Housekeeping becomes a stock-holding Location, same as Store —
-- an internal point, not a selling point.
ALTER TYPE "LocationType" ADD VALUE 'HOUSEKEEPING';

-- AlterEnum: reuse the existing Category tree for asset categorization.
ALTER TYPE "CategoryScope" ADD VALUE 'ASSETS';

-- AlterEnum: asset acquisitions get their own ledger source, distinct from
-- EXPENSE (durable equipment isn't day-to-day incidental spend).
ALTER TYPE "TransactionSource" ADD VALUE 'ASSET_PURCHASE';

-- CreateEnum
CREATE TYPE "AssetMovementType" AS ENUM ('RECEIPT', 'ADJUSTMENT', 'WRITE_OFF');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetNo" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'Each',
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2),
    "locationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "AssetMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitCost" DECIMAL(12,2),
    "paymentMethodId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "performedBy" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tenantId_assetNo_key" ON "Asset"("tenantId", "assetNo");

-- CreateIndex
CREATE INDEX "Asset_tenantId_categoryId_idx" ON "Asset"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "Asset_tenantId_locationId_idx" ON "Asset"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "AssetMovement_tenantId_assetId_occurredAt_idx" ON "AssetMovement"("tenantId", "assetId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMovement" ADD CONSTRAINT "AssetMovement_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
