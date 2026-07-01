-- Soft deprecate legacy marketplace product-ID columns without removing data.
-- Active runtime matching now uses marketplace_sku_id / marketplace_large_sku_id only.

COMMENT ON COLUMN "Product"."marketplace_product_id" IS
  'DEPRECATED: retained for backward compatibility. Inventory and marketplace export use marketplace_sku_id only.';

COMMENT ON COLUMN "Product"."marketplace_large_product_id" IS
  'DEPRECATED: retained for backward compatibility. Inventory and marketplace export use marketplace_large_sku_id only.';
