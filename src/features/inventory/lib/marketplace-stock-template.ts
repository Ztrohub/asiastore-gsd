import type ExcelJS from "exceljs";
import type { ProductRecord } from "@/lib/offline/db";
import { getProductMarketplaceListings } from "@/lib/inventory/marketplace";
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
      .flatMap((product) =>
        getProductMarketplaceListings(product).map((listing) => [
          `${listing.marketplace_product_id.trim()}::${listing.marketplace_sku_id.trim()}`,
          listing,
        ] as const),
      ),
  );
}

export function updateMarketplaceWorkbookStock(
  workbook: ExcelJS.Workbook,
  config: MarketplaceExportConfig,
  products: ProductRecord[],
) {
  const sheet = workbook.worksheets[0];

  if (!sheet) {
    return {
      workbook,
      summary: {
        totalRows: 0,
        matchedRows: 0,
        zeroedRows: 0,
      },
    };
  }

  const lookup = buildMarketplaceLookup(products);
  const productIdIndex = columnLabelToIndex(config.productIdColumn);
  const skuIdIndex = columnLabelToIndex(config.skuIdColumn);
  const stockIndex = columnLabelToIndex(config.stockColumn);

  let totalRows = 0;
  let matchedRows = 0;
  let zeroedRows = 0;

  for (let rowNumber = Math.max(config.startRow, 1); rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const productId = row.getCell(productIdIndex + 1).text.trim();
    const skuId = row.getCell(skuIdIndex + 1).text.trim();

    if (!productId && !skuId) {
      continue;
    }

    totalRows += 1;
    const listing = lookup.get(`${productId}::${skuId}`);

    if (listing) {
      matchedRows += 1;
      row.getCell(stockIndex + 1).value = calculateMarketplaceStockValue(
        listing.stock,
        config.percentage,
      );
    } else {
      zeroedRows += 1;
      row.getCell(stockIndex + 1).value = 0;
    }
  }

  return {
    workbook,
    summary: {
      totalRows,
      matchedRows,
      zeroedRows,
    },
  };
}
