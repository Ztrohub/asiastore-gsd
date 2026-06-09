-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'CASHIER');

-- CreateEnum
CREATE TYPE "InventoryMutationType" AS ENUM ('SALES_OUT', 'STOCK_IN', 'STOCK_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryMutationUnit" AS ENUM ('SMALL', 'LARGE');

-- CreateEnum
CREATE TYPE "PosPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCredentialChangeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isOffline" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMutationEvent" (
    "id_queue" TEXT NOT NULL,
    "id_transaksi" TEXT NOT NULL,
    "id_produk" TEXT NOT NULL,
    "id_user" TEXT NOT NULL,
    "jenis_mutasi" "InventoryMutationType" NOT NULL,
    "unit_mutasi" "InventoryMutationUnit" NOT NULL DEFAULT 'SMALL',
    "delta_qty" INTEGER NOT NULL,
    "logical_clock" INTEGER NOT NULL,
    "client_timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMutationEvent_pkey" PRIMARY KEY ("id_queue")
);

-- CreateTable
CREATE TABLE "Product" (
    "id_produk" TEXT NOT NULL,
    "nama_produk" TEXT NOT NULL,
    "sku" TEXT,
    "harga_jual" INTEGER NOT NULL,
    "harga_jual_unit_besar" INTEGER,
    "stok_saat_ini" INTEGER NOT NULL DEFAULT 0,
    "stok_unit_besar_saat_ini" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "unit_small_name" TEXT NOT NULL DEFAULT 'pcs',
    "unit_large_name" TEXT,
    "unit_large_to_small" INTEGER,
    "allow_buy_in_small" BOOLEAN NOT NULL DEFAULT true,
    "allow_buy_in_large" BOOLEAN NOT NULL DEFAULT false,
    "allow_sell_in_small" BOOLEAN NOT NULL DEFAULT true,
    "allow_sell_in_large" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id_produk")
);

-- CreateTable
CREATE TABLE "PosTransaction" (
    "id_transaksi" TEXT NOT NULL,
    "short_id" TEXT NOT NULL,
    "kasir_user_id" TEXT NOT NULL,
    "kasir_username" TEXT NOT NULL,
    "payment_method" "PosPaymentMethod" NOT NULL,
    "subtotal_amount" INTEGER NOT NULL,
    "item_discount" INTEGER NOT NULL DEFAULT 0,
    "order_discount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "amount_received" INTEGER,
    "change_amount" INTEGER,
    "counts_for_cash" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "client_timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosTransaction_pkey" PRIMARY KEY ("id_transaksi")
);

-- CreateTable
CREATE TABLE "PosTransactionLine" (
    "id" TEXT NOT NULL,
    "id_transaksi" TEXT NOT NULL,
    "id_produk" TEXT NOT NULL,
    "nama_produk" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "line_discount" INTEGER NOT NULL DEFAULT 0,
    "line_total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosTransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "LoginAudit_userId_loginAt_idx" ON "LoginAudit"("userId", "loginAt");

-- CreateIndex
CREATE INDEX "InventoryMutationEvent_id_produk_client_timestamp_idx" ON "InventoryMutationEvent"("id_produk", "client_timestamp");

-- CreateIndex
CREATE INDEX "InventoryMutationEvent_id_user_client_timestamp_idx" ON "InventoryMutationEvent"("id_user", "client_timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_nama_produk_idx" ON "Product"("nama_produk");

-- CreateIndex
CREATE INDEX "Product_is_active_idx" ON "Product"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "PosTransaction_short_id_key" ON "PosTransaction"("short_id");

-- CreateIndex
CREATE INDEX "PosTransaction_client_timestamp_idx" ON "PosTransaction"("client_timestamp");

-- CreateIndex
CREATE INDEX "PosTransaction_payment_method_client_timestamp_idx" ON "PosTransaction"("payment_method", "client_timestamp");

-- CreateIndex
CREATE INDEX "PosTransactionLine_id_transaksi_idx" ON "PosTransactionLine"("id_transaksi");

-- AddForeignKey
ALTER TABLE "LoginAudit" ADD CONSTRAINT "LoginAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTransactionLine" ADD CONSTRAINT "PosTransactionLine_id_transaksi_fkey" FOREIGN KEY ("id_transaksi") REFERENCES "PosTransaction"("id_transaksi") ON DELETE CASCADE ON UPDATE CASCADE;
