-- AlterEnum
ALTER TYPE "LocationType" ADD VALUE 'STORE';
ALTER TYPE "LocationType" ADD VALUE 'SHOP';

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "canSellMenu" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canSellProducts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canSellRooms" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "canSellServices" BOOLEAN NOT NULL DEFAULT true;
