-- CreateEnum
CREATE TYPE "PosOrderChannel" AS ENUM ('FOOD', 'PRODUCTS', 'SERVICES');

-- AlterTable: every existing order is a food order today.
ALTER TABLE "PosOrder" ADD COLUMN "channel" "PosOrderChannel" NOT NULL DEFAULT 'FOOD';

-- AlterTable: menuItemId becomes optional — a PRODUCTS/SERVICES line item
-- has no menu item at all, it has a productId/serviceId instead.
ALTER TABLE "PosOrderItem" ALTER COLUMN "menuItemId" DROP NOT NULL;
ALTER TABLE "PosOrderItem" ADD COLUMN "productId" TEXT;
ALTER TABLE "PosOrderItem" ADD COLUMN "serviceId" TEXT;

-- AddForeignKey
ALTER TABLE "PosOrderItem" ADD CONSTRAINT "PosOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderItem" ADD CONSTRAINT "PosOrderItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
