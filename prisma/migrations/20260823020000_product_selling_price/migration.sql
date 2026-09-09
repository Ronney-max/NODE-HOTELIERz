-- AlterTable: retail selling price, distinct from unitCost (inventory
-- valuation). Nullable — a product used only as a recipe ingredient never
-- needs one, and the Products POS only lists products that have one set.
ALTER TABLE "Product" ADD COLUMN "sellingPrice" DECIMAL(12,2);
