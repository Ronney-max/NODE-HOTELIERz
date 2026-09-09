-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('WALK_IN', 'PHONE', 'WEBSITE', 'BOOKING_ENGINE', 'TRAVEL_AGENT', 'OTA', 'CORPORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "CancellationReason" AS ENUM ('CHANGED_MIND', 'NO_SHOW', 'FOUND_ALTERNATIVE', 'DUPLICATE_BOOKING', 'HOTEL_CANCELLED', 'OTHER');

-- CreateTable: generalized sequence table, replacing CustomerSequence.
CREATE TABLE "TenantSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TenantSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantSequence_tenantId_key_key" ON "TenantSequence"("tenantId", "key");

ALTER TABLE "TenantSequence" ADD CONSTRAINT "TenantSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing per-tenant customer counters into the new shape so
-- numbering continues from where it left off instead of restarting at 1.
INSERT INTO "TenantSequence" ("id", "tenantId", "key", "lastNumber")
SELECT gen_random_uuid()::text, "tenantId", 'customer', "lastNumber" FROM "CustomerSequence";

DROP TABLE "CustomerSequence";

-- AlterEnum: BOOKED -> mapped to CONFIRMED (defensively, even though the
-- live DB currently has zero BOOKED rows — verified before writing this).
CREATE TYPE "ReservationStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
ALTER TABLE "Reservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "status" TYPE "ReservationStatus_new" USING (
  CASE "status"::text
    WHEN 'BOOKED' THEN 'CONFIRMED'
    ELSE "status"::text
  END
)::"ReservationStatus_new";
DROP TYPE "ReservationStatus";
ALTER TYPE "ReservationStatus_new" RENAME TO "ReservationStatus";
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable: new Reservation columns. reservationNo added nullable first,
-- backfilled below, then locked NOT NULL + unique.
ALTER TABLE "Reservation" ADD COLUMN     "bookingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "cancellationNotes" TEXT,
ADD COLUMN     "cancellationReason" "CancellationReason",
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "reservationNo" TEXT,
ADD COLUMN     "source" "ReservationSource" NOT NULL DEFAULT 'WALK_IN';

WITH numbered AS (
  SELECT id, "tenantId", ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt") AS rn
  FROM "Reservation"
)
UPDATE "Reservation" r
SET "reservationNo" = 'RES-' || LPAD(numbered.rn::text, 6, '0')
FROM numbered
WHERE r.id = numbered.id;

ALTER TABLE "Reservation" ALTER COLUMN "reservationNo" SET NOT NULL;

CREATE UNIQUE INDEX "Reservation_tenantId_reservationNo_key" ON "Reservation"("tenantId", "reservationNo");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed each tenant's reservation-number counter to continue right after its
-- backfilled rows.
INSERT INTO "TenantSequence" ("id", "tenantId", "key", "lastNumber")
SELECT gen_random_uuid()::text, "tenantId", 'reservation', COUNT(*)::int FROM "Reservation" GROUP BY "tenantId"
ON CONFLICT ("tenantId", "key") DO UPDATE SET "lastNumber" = EXCLUDED."lastNumber";
