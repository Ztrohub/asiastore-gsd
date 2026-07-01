export type MarketplaceExportConfig = {
  skuIdColumn: string;
  stockColumn: string;
  startRow: number;
  percentage: number;
};

export const DEFAULT_MARKETPLACE_EXPORT_CONFIG: MarketplaceExportConfig = {
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

    const parsed = JSON.parse(raw) as Partial<MarketplaceExportConfig> & {
      productIdColumn?: unknown;
    };

    return {
      skuIdColumn:
        typeof parsed.skuIdColumn === "string"
          ? parsed.skuIdColumn
          : DEFAULT_MARKETPLACE_EXPORT_CONFIG.skuIdColumn,
      stockColumn:
        typeof parsed.stockColumn === "string"
          ? parsed.stockColumn
          : DEFAULT_MARKETPLACE_EXPORT_CONFIG.stockColumn,
      startRow:
        typeof parsed.startRow === "number"
          ? parsed.startRow
          : DEFAULT_MARKETPLACE_EXPORT_CONFIG.startRow,
      percentage:
        typeof parsed.percentage === "number"
          ? parsed.percentage
          : DEFAULT_MARKETPLACE_EXPORT_CONFIG.percentage,
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
