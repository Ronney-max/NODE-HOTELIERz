CREATE TABLE "RoomType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "capacity" INTEGER NOT NULL DEFAULT 2,
  "baseRate" DECIMAL(12,2) NOT NULL,
  "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoomType_tenantId_name_key" ON "RoomType"("tenantId", "name");
CREATE INDEX "RoomType_tenantId_isActive_idx" ON "RoomType"("tenantId", "isActive");
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
