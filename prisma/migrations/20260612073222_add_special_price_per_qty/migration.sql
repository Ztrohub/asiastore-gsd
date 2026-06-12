-- AlterTable
ALTER TABLE "PosTransactionLine" ADD COLUMN     "pricing_snapshot" JSONB;

-- CreateTable
CREATE TABLE "ProductSpecialPrice" (
    "id" TEXT NOT NULL,
    "id_produk" TEXT NOT NULL,
    "unit_mutasi" "InventoryMutationUnit" NOT NULL,
    "qty_tenths" INTEGER NOT NULL,
    "harga" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSpecialPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductSpecialPrice_id_produk_unit_mutasi_idx" ON "ProductSpecialPrice"("id_produk", "unit_mutasi");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSpecialPrice_id_produk_unit_mutasi_qty_tenths_key" ON "ProductSpecialPrice"("id_produk", "unit_mutasi", "qty_tenths");

-- AddForeignKey
ALTER TABLE "ProductSpecialPrice" ADD CONSTRAINT "ProductSpecialPrice_id_produk_fkey" FOREIGN KEY ("id_produk") REFERENCES "Product"("id_produk") ON DELETE CASCADE ON UPDATE CASCADE;

