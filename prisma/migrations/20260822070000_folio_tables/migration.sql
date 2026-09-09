-- CreateEnum
CREATE TYPE "FolioStatus" AS ENUM ('OPEN', 'SETTLED');

-- CreateEnum
CREATE TYPE "FolioLineSource" AS ENUM ('ROOM', 'SERVICE', 'POS_ORDER', 'AD_HOC');

-- CreateEnum
CREATE TYPE "FolioPaymentKind" AS ENUM ('DEPOSIT', 'SETTLEMENT');

-- CreateTable
CREATE TABLE "ReservationGuest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idNumber" TEXT,
    "notes" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folioNo" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "status" "FolioStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioLineItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "source" "FolioLineSource" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sourceRefId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "FolioLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "kind" "FolioPaymentKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "FolioPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationGuest_tenantId_reservationId_idx" ON "ReservationGuest"("tenantId", "reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_reservationId_key" ON "Folio"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_tenantId_folioNo_key" ON "Folio"("tenantId", "folioNo");

-- CreateIndex
CREATE INDEX "FolioLineItem_tenantId_folioId_idx" ON "FolioLineItem"("tenantId", "folioId");

-- CreateIndex
CREATE INDEX "FolioPayment_tenantId_folioId_idx" ON "FolioPayment"("tenantId", "folioId");

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioLineItem" ADD CONSTRAINT "FolioLineItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioLineItem" ADD CONSTRAINT "FolioLineItem_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every pre-existing Reservation needs a Folio so the 1:1 relation
-- isn't left null for real historical data. Numbered sequentially per
-- tenant, continuing the same 'folio' counter key used going forward.
INSERT INTO "Folio" ("id", "tenantId", "folioNo", "reservationId", "status", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  r."tenantId",
  'FOL-' || LPAD(ROW_NUMBER() OVER (PARTITION BY r."tenantId" ORDER BY r."createdAt")::text, 6, '0'),
  r.id,
  CASE WHEN r.status = 'CHECKED_OUT' THEN 'SETTLED' ELSE 'OPEN' END::"FolioStatus",
  r."createdAt",
  now()
FROM "Reservation" r;

INSERT INTO "TenantSequence" ("id", "tenantId", "key", "lastNumber")
SELECT gen_random_uuid()::text, "tenantId", 'folio', COUNT(*)::int FROM "Folio" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "key") DO UPDATE SET "lastNumber" = EXCLUDED."lastNumber";
