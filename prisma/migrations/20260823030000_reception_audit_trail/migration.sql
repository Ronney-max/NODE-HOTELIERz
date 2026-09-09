-- Reception audit trail: who created/updated a record, and (where relevant)
-- which location it happened at. All new columns are nullable — purely
-- additive, no backfill needed for existing rows.

-- AlterTable: Customer
ALTER TABLE "Customer" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Customer" ADD COLUMN "updatedBy" TEXT;
ALTER TABLE "Customer" ADD COLUMN "locationId" TEXT;

-- AlterTable: Room
ALTER TABLE "Room" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Room" ADD COLUMN "updatedBy" TEXT;

-- AlterTable: RoomRate
ALTER TABLE "RoomRate" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "RoomRate" ADD COLUMN "updatedBy" TEXT;

-- AlterTable: RoomType
ALTER TABLE "RoomType" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "RoomType" ADD COLUMN "updatedBy" TEXT;

-- AlterTable: HousekeepingTask
ALTER TABLE "HousekeepingTask" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "HousekeepingTask" ADD COLUMN "updatedBy" TEXT;

-- AlterTable: Reservation (createdBy/createdAt already existed)
ALTER TABLE "Reservation" ADD COLUMN "updatedBy" TEXT;
ALTER TABLE "Reservation" ADD COLUMN "locationId" TEXT;

-- AlterTable: ReservationGuest
ALTER TABLE "ReservationGuest" ADD COLUMN "addedBy" TEXT;

-- CreateEnum
CREATE TYPE "ReservationActivityAction" AS ENUM ('CREATED', 'UPDATED', 'CHECKED_IN', 'EXTENDED', 'GUEST_ADDED', 'GUEST_REMOVED', 'CHARGE_ADDED', 'CHARGE_REMOVED', 'DEPOSIT_RECORDED', 'CANCELLED', 'NO_SHOW', 'CHECKED_OUT');

-- CreateTable
CREATE TABLE "ReservationActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "action" "ReservationActivityAction" NOT NULL,
    "summary" TEXT NOT NULL,
    "performedBy" TEXT,
    "locationId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationActivity_tenantId_reservationId_occurredAt_idx" ON "ReservationActivity"("tenantId", "reservationId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Room" ADD CONSTRAINT "Room_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_addedBy_fkey" FOREIGN KEY ("addedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationActivity" ADD CONSTRAINT "ReservationActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationActivity" ADD CONSTRAINT "ReservationActivity_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationActivity" ADD CONSTRAINT "ReservationActivity_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReservationActivity" ADD CONSTRAINT "ReservationActivity_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
