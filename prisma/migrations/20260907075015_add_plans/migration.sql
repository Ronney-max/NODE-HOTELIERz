-- CreateEnum
CREATE TYPE "PlanBillingType" AS ENUM ('MONTHLY', 'ONE_TIME');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "planId" TEXT;

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingType" "PlanBillingType" NOT NULL DEFAULT 'MONTHLY',
    "currency" "Currency" NOT NULL DEFAULT 'KES',
    "monthlyPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "oneTimePrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "annualMaintenanceFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supportLevel" TEXT,
    "maxBranches" INTEGER NOT NULL DEFAULT 1,
    "maxUsers" INTEGER NOT NULL DEFAULT 10,
    "maxDevices" INTEGER NOT NULL DEFAULT 10,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
