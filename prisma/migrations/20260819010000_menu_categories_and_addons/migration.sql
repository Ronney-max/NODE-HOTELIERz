-- CreateEnum
CREATE TYPE "CategoryScope" AS ENUM ('STORE', 'RESTAURANT', 'BAR', 'GYM', 'SPA', 'ROOMS');

-- DropForeignKey: detach MenuItem from MenuCategory before MenuCategory is folded into Category.
ALTER TABLE "MenuItem" DROP CONSTRAINT "MenuItem_categoryId_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "scope" "CategoryScope" NOT NULL DEFAULT 'STORE';

-- Fold every MenuCategory row into Category as a top-level RESTAURANT-scope
-- category, reusing the same id so MenuItem.categoryId keeps pointing at a
-- valid row without needing to be remapped.
INSERT INTO "Category" ("id", "tenantId", "scope", "name", "description", "parentId", "level", "isActive", "createdAt", "updatedAt")
SELECT "id", "tenantId", 'RESTAURANT', "name", NULL, NULL, 1, true, "createdAt", "updatedAt" FROM "MenuCategory";

-- DropForeignKey
ALTER TABLE "MenuCategory" DROP CONSTRAINT "MenuCategory_tenantId_fkey";

-- DropTable
DROP TABLE "MenuCategory";

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "photoUrl" TEXT;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "Category_tenantId_parentId_idx";

-- DropIndex
DROP INDEX "Category_tenantId_parentId_name_key";

-- CreateIndex
CREATE INDEX "Category_tenantId_scope_parentId_idx" ON "Category"("tenantId", "scope", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_tenantId_scope_parentId_name_key" ON "Category"("tenantId", "scope", "parentId", "name");

-- CreateTable
CREATE TABLE "_AddonToMenuItem" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AddonToMenuItem_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AddonToMenuItem_B_index" ON "_AddonToMenuItem"("B");

-- AddForeignKey
ALTER TABLE "_AddonToMenuItem" ADD CONSTRAINT "_AddonToMenuItem_A_fkey" FOREIGN KEY ("A") REFERENCES "Addon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AddonToMenuItem" ADD CONSTRAINT "_AddonToMenuItem_B_fkey" FOREIGN KEY ("B") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
