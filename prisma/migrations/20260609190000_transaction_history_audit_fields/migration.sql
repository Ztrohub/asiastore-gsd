ALTER TABLE "PosTransaction"
ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "editedAt" TIMESTAMP(3),
ADD COLUMN "editedByUserId" TEXT,
ADD COLUMN "editedByUsername" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByUserId" TEXT,
ADD COLUMN "deletedByUsername" TEXT;

ALTER TABLE "PosTransactionLine"
ADD COLUMN "unit_mutasi" "InventoryMutationUnit",
ADD COLUMN "unit_label" TEXT;

CREATE INDEX "PosTransaction_is_deleted_client_timestamp_idx"
ON "PosTransaction"("is_deleted", "client_timestamp");
