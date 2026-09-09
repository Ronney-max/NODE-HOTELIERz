-- Evolve InventoryMovement into the stock ledger:
--  * broaden the movement-type enum
--  * add running-balance + cash-value + source columns
--  * link performedBy to Employee for a "recorded by" name

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('OPENING_STOCK', 'PURCHASE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'RETURN', 'DAMAGE_LOSS', 'ADJUSTMENT', 'BORROWED_IN', 'RETURNED_BORROWED_STOCK', 'LENT_OUT', 'LOAN_RETURNED');

-- New columns
ALTER TABLE "InventoryMovement"
  ADD COLUMN "balanceBefore" DECIMAL(12,3),
  ADD COLUMN "balanceAfter"  DECIMAL(12,3),
  ADD COLUMN "unitCost"      DECIMAL(12,2),
  ADD COLUMN "value"         DECIMAL(12,2),
  ADD COLUMN "sourceType"    TEXT,
  ADD COLUMN "sourceRefId"   TEXT,
  ADD COLUMN "type_new"      "StockMovementType";

-- Backfill the new type from the old one. RECEIPT was used both for a
-- product's opening stock ("Opening stock" note) and any other receive;
-- TRANSFER rows are signed, so the sign picks the direction.
UPDATE "InventoryMovement" SET "type_new" = (
  CASE
    WHEN "type" = 'RECEIPT'  AND coalesce("note", '') ILIKE 'Opening stock%' THEN 'OPENING_STOCK'
    WHEN "type" = 'RECEIPT'  THEN 'PURCHASE'
    WHEN "type" = 'DISPATCH' THEN 'SALE'
    WHEN "type" = 'TRANSFER' AND "quantity" < 0 THEN 'TRANSFER_OUT'
    WHEN "type" = 'TRANSFER' THEN 'TRANSFER_IN'
    ELSE 'ADJUSTMENT'
  END
)::"StockMovementType";

ALTER TABLE "InventoryMovement" DROP COLUMN "type";
ALTER TABLE "InventoryMovement" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "InventoryMovement" ALTER COLUMN "type" SET NOT NULL;

-- DropEnum
DROP TYPE "InventoryMovementType";

-- CreateIndex
CREATE INDEX "InventoryMovement_tenantId_occurredAt_idx" ON "InventoryMovement"("tenantId", "occurredAt");
CREATE INDEX "InventoryMovement_tenantId_type_occurredAt_idx" ON "InventoryMovement"("tenantId", "type", "occurredAt");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
