-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "wooId" INTEGER;

-- AlterTable
ALTER TABLE "ProductVariant" ADD COLUMN     "inStock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salePriceCents" INTEGER,
ADD COLUMN     "wooId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Product_wooId_key" ON "Product"("wooId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_wooId_key" ON "ProductVariant"("wooId");

