import * as XLSX from "xlsx";
import type { ProductRecord } from "@/lib/offline/db";
import type { MarketplaceExportConfig } from "@/features/inventory/lib/marketplace-stock-config";

export function columnLabelToIndex(label: string) {
  const normalized = label.trim().toUpperCase();
  let value = 0;

  for (const char of normalized) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }

  return value - 1;
}

export function calculateMarketplaceStockValue(stock: number, percentage: number) {
  return Math.ceil((Math.max(0, stock) * Math.max(0, percentage)) / 100);
}

function buildMarketplaceLookup(products: ProductRecord[]) {
  return new Map(
    products
      .filter(
        (product) =>
          product.is_marketplace &&
          product.marketplace_product_id &&
          product.marketplace_sku_id,
      )
      .map((product) => [
        `${String(product.marketplace_product_id).trim()}::${String(product.marketplace_sku_id).trim()}`,
        product,
      ]),
  );
}

export function updateMarketplaceWorkbookStock(
  workbook: XLSX.WorkBook,
  config: MarketplaceExportConfig,
  products: ProductRecord[],
) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: true,
  });
  const lookup = buildMarketplaceLookup(products);
  const productIdIndex = columnLabelToIndex(config.productIdColumn);
  const skuIdIndex = columnLabelToIndex(config.skuIdColumn);
  const stockIndex = columnLabelToIndex(config.stockColumn);

  let totalRows = 0;
  let matchedRows = 0;
  let zeroedRows = 0;

  for (let rowIndex = Math.max(config.startRow - 1, 0); rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const productId = String(row[productIdIndex] ?? "").trim();
    const skuId = String(row[skuIdIndex] ?? "").trim();

    if (!productId && !skuId) {
      continue;
    }

    totalRows += 1;
    const product = lookup.get(`${productId}::${skuId}`);

    if (product) {
      matchedRows += 1;
      row[stockIndex] = calculateMarketplaceStockValue(product.stok_saat_ini, config.percentage);
    } else {
      zeroedRows += 1;
      row[stockIndex] = 0;
    }

    rows[rowIndex] = row;
  }

  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);

  return {
    workbook,
    summary: {
      totalRows,
      matchedRows,
      zeroedRows,
    },
  };
}
