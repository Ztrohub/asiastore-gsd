-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "is_marketplace" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "marketplace_product_id" TEXT,
ADD COLUMN     "marketplace_product_name" TEXT,
ADD COLUMN     "marketplace_sku_id" TEXT;
