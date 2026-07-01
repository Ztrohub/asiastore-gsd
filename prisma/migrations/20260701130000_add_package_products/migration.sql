CREATE TYPE "ProductKind" AS ENUM ('NORMAL', 'PACKAGE');

ALTER TABLE "Product"
  ADD COLUMN "product_kind" "ProductKind" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE "ProductPackageItem" (
  "id" TEXT NOT NULL,
  "package_product_id" TEXT NOT NULL,
  "component_product_id" TEXT NOT NULL,
  "component_unit" "InventoryMutationUnit" NOT NULL,
  "component_qty" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductPackageItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductPackageItem_package_product_id_idx"
  ON "ProductPackageItem"("package_product_id");

CREATE INDEX "ProductPackageItem_component_product_id_idx"
  ON "ProductPackageItem"("component_product_id");

CREATE UNIQUE INDEX "ProductPackageItem_package_product_id_component_product_id_component_unit_key"
  ON "ProductPackageItem"("package_product_id", "component_product_id", "component_unit");

ALTER TABLE "ProductPackageItem"
  ADD CONSTRAINT "ProductPackageItem_package_product_id_fkey"
  FOREIGN KEY ("package_product_id") REFERENCES "Product"("id_produk")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductPackageItem"
  ADD CONSTRAINT "ProductPackageItem_component_product_id_fkey"
  FOREIGN KEY ("component_product_id") REFERENCES "Product"("id_produk")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PosTransactionLine"
  ADD COLUMN "stock_effect_snapshot" JSONB;
