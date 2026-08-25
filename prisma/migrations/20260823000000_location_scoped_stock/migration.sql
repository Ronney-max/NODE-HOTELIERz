-- Fold Store into Location: reuse each Store row's own id as the new
-- Location row's id, so every existing storeId value already IS a valid
-- Location id — no lookup/mapping table needed for the rest of this
-- migration. A warehouse doesn't run its own POS, so all four canSell*
-- flags are off regardless of their column default.
INSERT INTO "Location" (
  "id", "tenantId", "name", "type", "isActive",
  "canSellRooms", "canSellMenu", "canSellServices", "canSellProducts",
  "createdAt", "updatedAt"
)
SELECT "id", "tenantId", "name", 'STORE', "isActive",
  false, false, false, false,
  "createdAt", "updatedAt"
FROM "Store";

-- CreateTable
CREATE TABLE "ProductStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

-- Backfill: consolidate the old storeQuantity+kitchenQuantity split into one
-- balance at the product's (now-Location) former Store — the UI only ever
-- showed users their sum as "total stock" anyway, and there's no genuine
-- second "Kitchen" location in today's data to preserve a split against.
INSERT INTO "ProductStock" ("id", "tenantId", "productId", "locationId", "quantity", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."tenantId", p."id", p."storeId", p."storeQuantity" + p."kitchenQuantity", now(), now()
FROM "Product" p;

-- CreateIndex
CREATE UNIQUE INDEX "ProductStock_tenantId_productId_locationId_key" ON "ProductStock"("tenantId", "productId", "locationId");

-- CreateIndex
CREATE INDEX "ProductStock_tenantId_locationId_idx" ON "ProductStock"("tenantId", "locationId");

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductStock" ADD CONSTRAINT "ProductStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable InventoryMovement: storeId -> locationId. The values are
-- already correct (Location reused Store's own id above), so this is a
-- rename, not a backfill.
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_storeId_fkey";

-- DropIndex
DROP INDEX "InventoryMovement_tenantId_storeId_occurredAt_idx";

ALTER TABLE "InventoryMovement" RENAME COLUMN "storeId" TO "locationId";
ALTER TABLE "InventoryMovement" DROP COLUMN "location";

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_locationId_occurredAt_idx" ON "InventoryMovement"("tenantId", "locationId", "occurredAt");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Product: drop storeId/storeQuantity/kitchenQuantity — stock now
-- lives entirely in ProductStock.
ALTER TABLE "Product" DROP CONSTRAINT "Product_storeId_fkey";

-- DropIndex
DROP INDEX "Product_tenantId_storeId_idx";

ALTER TABLE "Product" DROP COLUMN "storeId";
ALTER TABLE "Product" DROP COLUMN "storeQuantity";
ALTER TABLE "Product" DROP COLUMN "kitchenQuantity";

-- DropTable
ALTER TABLE "Store" DROP CONSTRAINT "Store_tenantId_fkey";
DROP TABLE "Store";

-- DropEnum
DROP TYPE "StockLocation";

-- CreateTable: Service <-> Location implicit many-to-many (identical shape
-- to the existing _LocationToMenuItem table).
CREATE TABLE "_LocationToService" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LocationToService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_LocationToService_B_index" ON "_LocationToService"("B");

-- AddForeignKey
ALTER TABLE "_LocationToService" ADD CONSTRAINT "_LocationToService_A_fkey" FOREIGN KEY ("A") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LocationToService" ADD CONSTRAINT "_LocationToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
