-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('PERSONAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PreferredLanguage" AS ENUM ('ENGLISH', 'SWAHILI', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactMethod" AS ENUM ('PHYSICAL', 'CALL', 'WHATSAPP', 'EMAIL');

-- AlterTable: add customerNo as nullable first — it's backfilled below,
-- then locked to NOT NULL + unique once every existing row has a value.
ALTER TABLE "Customer" ADD COLUMN     "address" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "billingPhone" TEXT,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "carColour" TEXT,
ADD COLUMN     "carModel" TEXT,
ADD COLUMN     "carRegistration" TEXT,
ADD COLUMN     "contactMethod" "ContactMethod",
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "customerNo" TEXT,
ADD COLUMN     "customerType" "CustomerType" NOT NULL DEFAULT 'PERSONAL',
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "kraPin" TEXT,
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "preferredCurrency" "Currency",
ADD COLUMN     "preferredLanguage" "PreferredLanguage",
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "website" TEXT,
ALTER COLUMN "lastName" DROP NOT NULL,
ALTER COLUMN "phone" SET NOT NULL;

-- CreateTable
CREATE TABLE "CustomerSequence" (
    "tenantId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CustomerSequence_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "CustomerSequence" ADD CONSTRAINT "CustomerSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill customerNo for any pre-existing rows, numbered per tenant in
-- creation order, before the column is locked to NOT NULL + unique.
WITH numbered AS (
  SELECT id, "tenantId", ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt") AS rn
  FROM "Customer"
)
UPDATE "Customer" c
SET "customerNo" = 'CUST-' || LPAD(numbered.rn::text, 6, '0')
FROM numbered
WHERE c.id = numbered.id;

-- Seed each tenant's sequence counter to continue right after its
-- backfilled rows, so the next atomic increment can't collide with them.
INSERT INTO "CustomerSequence" ("tenantId", "lastNumber")
SELECT "tenantId", COUNT(*)::int FROM "Customer" GROUP BY "tenantId"
ON CONFLICT ("tenantId") DO UPDATE SET "lastNumber" = EXCLUDED."lastNumber";

-- Now safe to enforce NOT NULL + uniqueness.
ALTER TABLE "Customer" ALTER COLUMN "customerNo" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Customer_tenantId_status_idx" ON "Customer"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_tenantId_customerNo_key" ON "Customer"("tenantId", "customerNo");
