
-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('RECEPTION', 'RESTAURANT', 'CAFE', 'BAKERY', 'BAR', 'GYM', 'SPA');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "closingTime" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "openingTime" TEXT,
ADD COLUMN     "primaryPhone" TEXT,
ADD COLUMN     "secondaryPhone" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "LocationType";

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

