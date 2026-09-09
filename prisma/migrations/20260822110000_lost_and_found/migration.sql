-- CreateEnum
CREATE TYPE "LostFoundStatus" AS ENUM ('UNCLAIMED', 'COLLECTED');

-- CreateTable
CREATE TABLE "LostFoundItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemNo" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "roomId" TEXT,
    "locationNote" TEXT,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "foundBy" TEXT,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'UNCLAIMED',
    "collectedByName" TEXT,
    "collectedByContact" TEXT,
    "collectedAt" TIMESTAMP(3),
    "collectedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LostFoundItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LostFoundItem_tenantId_itemNo_key" ON "LostFoundItem"("tenantId", "itemNo");

-- CreateIndex
CREATE INDEX "LostFoundItem_tenantId_status_idx" ON "LostFoundItem"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LostFoundItem_tenantId_roomId_idx" ON "LostFoundItem"("tenantId", "roomId");

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_foundBy_fkey" FOREIGN KEY ("foundBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_collectedBy_fkey" FOREIGN KEY ("collectedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
