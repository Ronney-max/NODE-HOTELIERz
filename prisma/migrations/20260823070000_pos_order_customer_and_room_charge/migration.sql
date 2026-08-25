-- AlterTable: who a sale is actually for, independent of which table they
-- sat at and independent of how the bill eventually gets settled.
ALTER TABLE "PosOrder" ADD COLUMN "customerId" TEXT;

-- CreateIndex
CREATE INDEX "PosOrder_customerId_idx" ON "PosOrder"("customerId");

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed one system "Room Charge" payment method per existing tenant — used
-- internally when a POS order is settled by billing a checked-in guest's
-- room instead of collecting cash/card directly. Mirrors the same
-- CROSS JOIN "Tenant" seeding pattern the original Cash/M-Pesa/Card/... rows
-- used. Hidden from normal payment-method pickers client-side by code.
INSERT INTO "PaymentMethod" ("id", "tenantId", "name", "code", "isSystem", "isActive", "requiresReference", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", 'Room Charge', 'ROOM_CHARGE', true, true, false, 99, now(), now()
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "PaymentMethod" pm WHERE pm."tenantId" = t."id" AND pm."code" = 'ROOM_CHARGE'
);
