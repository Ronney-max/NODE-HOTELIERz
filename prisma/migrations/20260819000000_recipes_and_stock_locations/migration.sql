-- CreateEnum
CREATE TYPE "StockLocation" AS ENUM ('STORE', 'KITCHEN');

-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'TRANSFER';

-- DropForeignKey
ALTER TABLE "MenuItemIngredient" DROP CONSTRAINT "MenuItemIngredient_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "MenuItemIngredient" DROP CONSTRAINT "MenuItemIngredient_productId_fkey";

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "location" "StockLocation" NOT NULL DEFAULT 'STORE';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "recipeId" TEXT;

-- AlterTable: split the single running stock quantity into store/kitchen
-- buckets, preserving existing balances as store stock (kitchen starts at 0).
ALTER TABLE "Product" ADD COLUMN     "kitchenQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
ADD COLUMN     "storeQuantity" DECIMAL(12,3) NOT NULL DEFAULT 0;

UPDATE "Product" SET "storeQuantity" = "quantity";

ALTER TABLE "Product" DROP COLUMN "quantity";

-- DropTable
DROP TABLE "MenuItemIngredient";

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "estimatedMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recipe_tenantId_idx" ON "Recipe"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_tenantId_name_key" ON "Recipe"("tenantId", "name");

-- CreateIndex
CREATE INDEX "RecipeIngredient_productId_idx" ON "RecipeIngredient"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredient_recipeId_productId_key" ON "RecipeIngredient"("recipeId", "productId");

-- CreateIndex
CREATE INDEX "MenuItem_tenantId_recipeId_idx" ON "MenuItem"("tenantId", "recipeId");

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
