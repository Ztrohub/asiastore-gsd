type ProductMarketplaceInput = {
  is_marketplace?: boolean | null;
  marketplace_product_name?: string | null;
  marketplace_product_id?: string | null;
  marketplace_sku_id?: string | null;
};

export const PRODUCT_MARKETPLACE_TEXT_MAX_LENGTH = 255;

function normalizeMarketplaceText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function hasIncomingMarketplaceText(input: ProductMarketplaceInput) {
  return (
    input.marketplace_product_name !== undefined ||
    input.marketplace_product_id !== undefined ||
    input.marketplace_sku_id !== undefined
  );
}

export function normalizeProductMarketplace(
  input: ProductMarketplaceInput,
  fallback?: ProductMarketplaceInput | null,
) {
  const useMarketplace =
    typeof input.is_marketplace === "boolean"
      ? input.is_marketplace
      : hasIncomingMarketplaceText(input)
        ? true
        : fallback?.is_marketplace === true;

  if (!useMarketplace) {
    return {
      is_marketplace: false,
      marketplace_product_name: undefined,
      marketplace_product_id: undefined,
      marketplace_sku_id: undefined,
    };
  }

  return {
    is_marketplace: true,
    marketplace_product_name: normalizeMarketplaceText(
      input.marketplace_product_name ?? fallback?.marketplace_product_name,
    ),
    marketplace_product_id: normalizeMarketplaceText(
      input.marketplace_product_id ?? fallback?.marketplace_product_id,
    ),
    marketplace_sku_id: normalizeMarketplaceText(
      input.marketplace_sku_id ?? fallback?.marketplace_sku_id,
    ),
  };
}

export function isValidProductMarketplace(input: ProductMarketplaceInput) {
  const normalized = normalizeProductMarketplace(input);
  if (!normalized.is_marketplace) {
    return true;
  }

  const values = [
    normalized.marketplace_product_name,
    normalized.marketplace_product_id,
    normalized.marketplace_sku_id,
  ];

  return values.every(
    (value) =>
      typeof value === "string" &&
      value.length > 0 &&
      value.length <= PRODUCT_MARKETPLACE_TEXT_MAX_LENGTH,
  );
}

export function toDatabaseProductMarketplace(
  input: ProductMarketplaceInput,
  fallback?: ProductMarketplaceInput | null,
) {
  const normalized = normalizeProductMarketplace(input, fallback);

  return {
    is_marketplace: normalized.is_marketplace,
    marketplace_product_name: normalized.marketplace_product_name ?? null,
    marketplace_product_id: normalized.marketplace_product_id ?? null,
    marketplace_sku_id: normalized.marketplace_sku_id ?? null,
  };
}
