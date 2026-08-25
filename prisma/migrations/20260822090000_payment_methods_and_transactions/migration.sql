-- RenameEnum: the old PaymentMethod enum now only backs Employee payroll
-- disbursement — free up the "PaymentMethod" name for the new tenant-
-- configurable model below.
ALTER TYPE "PaymentMethod" RENAME TO "EmployeePaymentMethod";

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETE', 'VOIDED');

-- CreateEnum
CREATE TYPE "TransactionSource" AS ENUM ('FOLIO_DEPOSIT', 'FOLIO_SETTLEMENT', 'POS_SALE');

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresReference" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_tenantId_code_key" ON "PaymentMethod"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_tenantId_name_key" ON "PaymentMethod"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed one system row per existing tenant for each value the old hardcoded
-- PaymentMethod enum had, so every historical FolioPayment/Payment row has
-- somewhere to point once its method column becomes a real FK below.
-- requiresReference mirrors the reference desktop app's own defaults.
INSERT INTO "PaymentMethod" ("id", "tenantId", "name", "code", "isSystem", "isActive", "requiresReference", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t."id", v."name", v."code", true, true, v."requiresReference", v."sortOrder", now(), now()
FROM "Tenant" t
CROSS JOIN (VALUES
  ('Cash', 'CASH', false, 0),
  ('M-Pesa', 'MPESA', true, 1),
  ('Card', 'CARD', true, 2),
  ('Bank Transfer', 'BANK_TRANSFER', true, 3),
  ('Cheque', 'CHEQUE', true, 4)
) AS v("name", "code", "requiresReference", "sortOrder");

-- AlterTable: FolioPayment.method (enum) -> FolioPayment.paymentMethodId (FK)
ALTER TABLE "FolioPayment" ADD COLUMN "paymentMethodId" TEXT;

UPDATE "FolioPayment" fp
SET "paymentMethodId" = pm."id"
FROM "PaymentMethod" pm
WHERE pm."tenantId" = fp."tenantId" AND pm."code" = fp."method"::text;

ALTER TABLE "FolioPayment" ALTER COLUMN "paymentMethodId" SET NOT NULL;
ALTER TABLE "FolioPayment" DROP COLUMN "method";

-- CreateIndex
CREATE INDEX "FolioPayment_tenantId_paymentMethodId_idx" ON "FolioPayment"("tenantId", "paymentMethodId");

-- AddForeignKey
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Payment.method (enum) -> Payment.paymentMethodId (FK)
ALTER TABLE "Payment" ADD COLUMN "paymentMethodId" TEXT;

UPDATE "Payment" p
SET "paymentMethodId" = pm."id"
FROM "PaymentMethod" pm
WHERE pm."tenantId" = p."tenantId" AND pm."code" = p."method"::text;

ALTER TABLE "Payment" ALTER COLUMN "paymentMethodId" SET NOT NULL;
ALTER TABLE "Payment" DROP COLUMN "method";

-- CreateIndex
CREATE INDEX "Payment_tenantId_paymentMethodId_idx" ON "Payment"("tenantId", "paymentMethodId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transactionNo" TEXT NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "source" "TransactionSource" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETE',
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethodId" TEXT,
    "reference" TEXT,
    "customerId" TEXT,
    "locationId" TEXT,
    "employeeId" TEXT,
    "description" TEXT,
    "sourceRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_tenantId_transactionNo_key" ON "Transaction"("tenantId", "transactionNo");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_createdAt_idx" ON "Transaction"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_tenantId_paymentMethodId_idx" ON "Transaction"("tenantId", "paymentMethodId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one Transaction per pre-existing FolioPayment and Payment row, so
-- the ledger isn't empty for money that already changed hands. Numbered
-- sequentially per tenant across both sources combined, ordered by when the
-- underlying payment actually happened.
INSERT INTO "Transaction" (
  "id", "tenantId", "transactionNo", "direction", "source", "status", "amount",
  "paymentMethodId", "reference", "customerId", "locationId", "employeeId", "description", "sourceRefId", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  src."tenantId",
  'TXN-' || LPAD(ROW_NUMBER() OVER (PARTITION BY src."tenantId" ORDER BY src."createdAt")::text, 6, '0'),
  'IN'::"TransactionDirection",
  src."source"::"TransactionSource",
  'COMPLETE'::"TransactionStatus",
  src."amount",
  src."paymentMethodId",
  src."reference",
  src."customerId",
  src."locationId",
  src."employeeId",
  src."description",
  src."sourceRefId",
  src."createdAt"
FROM (
  SELECT
    fp."tenantId",
    (CASE WHEN fp."kind" = 'DEPOSIT' THEN 'FOLIO_DEPOSIT' ELSE 'FOLIO_SETTLEMENT' END) AS "source",
    fp."amount",
    fp."paymentMethodId",
    fp."reference",
    res."customerId",
    NULL::text AS "locationId",
    fp."createdBy" AS "employeeId",
    (CASE WHEN fp."kind" = 'DEPOSIT' THEN 'Deposit — ' ELSE 'Checkout settlement — ' END) || res."reservationNo" AS "description",
    fp."id" AS "sourceRefId",
    fp."createdAt"
  FROM "FolioPayment" fp
  JOIN "Folio" f ON f."id" = fp."folioId"
  JOIN "Reservation" res ON res."id" = f."reservationId"

  UNION ALL

  SELECT
    p."tenantId",
    'POS_SALE' AS "source",
    p."amount",
    p."paymentMethodId",
    p."reference",
    r."customerId",
    o."locationId",
    p."receivedBy" AS "employeeId",
    'POS order #' || o."orderNumber" || ' payment' AS "description",
    p."id" AS "sourceRefId",
    p."createdAt"
  FROM "Payment" p
  JOIN "PosOrder" o ON o."id" = p."orderId"
  LEFT JOIN "Reservation" r ON r."id" = o."reservationId"
) src;

-- Seed the 'transaction' TenantSequence counter so nextSequenceNo() continues
-- from here rather than colliding with the numbers just backfilled above.
INSERT INTO "TenantSequence" ("id", "tenantId", "key", "lastNumber")
SELECT gen_random_uuid()::text, "tenantId", 'transaction', COUNT(*)::int FROM "Transaction" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "key") DO UPDATE SET "lastNumber" = EXCLUDED."lastNumber";
