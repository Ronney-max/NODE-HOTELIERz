-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('ROOM_ONLY', 'BED_AND_BREAKFAST', 'HALF_BOARD', 'FULL_BOARD');

-- CreateTable
CREATE TABLE "RoomRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "mealPlan" "MealPlan" NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomRate_tenantId_roomTypeId_idx" ON "RoomRate"("tenantId", "roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomRate_roomTypeId_mealPlan_key" ON "RoomRate"("roomTypeId", "mealPlan");

-- AddForeignKey
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
