export type MarketplaceExportConfig = {
  productIdColumn: string;
  skuIdColumn: string;
  stockColumn: string;
  startRow: number;
  percentage: number;
};

export const DEFAULT_MARKETPLACE_EXPORT_CONFIG: MarketplaceExportConfig = {
  productIdColumn: "B",
  skuIdColumn: "E",
  stockColumn: "I",
  startRow: 4,
  percentage: 30,
};

const STORAGE_KEY = "inventory.marketplace-export-config";

export function loadMarketplaceExportConfig() {
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_MARKETPLACE_EXPORT_CONFIG;
    }

    return {
      ...DEFAULT_MARKETPLACE_EXPORT_CONFIG,
      ...(JSON.parse(raw) as Partial<MarketplaceExportConfig>),
    };
  } catch {
    return DEFAULT_MARKETPLACE_EXPORT_CONFIG;
  }
}

export function saveMarketplaceExportConfig(config: MarketplaceExportConfig) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Best effort only. Feature must still work without local persistence.
  }
}
