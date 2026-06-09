ALTER TABLE "InventoryMutationEvent"
ALTER COLUMN "delta_qty" TYPE DOUBLE PRECISION
USING "delta_qty"::DOUBLE PRECISION;

ALTER TABLE "Product"
ALTER COLUMN "stok_saat_ini" SET DEFAULT 0,
ALTER COLUMN "stok_saat_ini" TYPE DOUBLE PRECISION
USING "stok_saat_ini"::DOUBLE PRECISION;

ALTER TABLE "Product"
ALTER COLUMN "stok_unit_besar_saat_ini" SET DEFAULT 0,
ALTER COLUMN "stok_unit_besar_saat_ini" TYPE DOUBLE PRECISION
USING "stok_unit_besar_saat_ini"::DOUBLE PRECISION;
