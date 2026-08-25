-- AlterTable: scope physical tables to a selling point, same convention as
-- MenuItem/Service locations (null = shared/unallocated).
ALTER TABLE "Table" ADD COLUMN "locationId" TEXT;

-- CreateIndex
CREATE INDEX "Table_tenantId_locationId_idx" ON "Table"("tenantId", "locationId");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
