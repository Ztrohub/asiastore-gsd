import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  calculateMarketplaceStockValue,
  columnLabelToIndex,
  updateMarketplaceWorkbookStock,
} from "@/features/inventory/lib/marketplace-stock-template";
import {
  DEFAULT_MARKETPLACE_EXPORT_CONFIG,
  loadMarketplaceExportConfig,
  saveMarketplaceExportConfig,
} from "@/features/inventory/lib/marketplace-stock-config";

describe("marketplace stock template utilities", () => {
  it("converts excel column labels into zero-based indexes", () => {
    expect(columnLabelToIndex("B")).toBe(1);
    expect(columnLabelToIndex("E")).toBe(4);
    expect(columnLabelToIndex("I")).toBe(8);
    expect(columnLabelToIndex("AA")).toBe(26);
  });

  it("calculates stock output with ceiling rounding and percentage input", () => {
    expect(calculateMarketplaceStockValue(10, 30)).toBe(3);
    expect(calculateMarketplaceStockValue(1, 30)).toBe(1);
    expect(calculateMarketplaceStockValue(11, 30)).toBe(4);
    expect(calculateMarketplaceStockValue(8, 0)).toBe(0);
  });

  it("updates only stock cells from the configured start row onward", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["header 1"],
      ["header 2"],
      ["header 3"],
      [null, "PROD-1", null, null, "SKU-1", null, null, null, 99],
      [null, "PROD-404", null, null, "SKU-404", null, null, null, 99],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Template");

    const result = updateMarketplaceWorkbookStock(
      workbook,
      {
        productIdColumn: "B",
        skuIdColumn: "E",
        stockColumn: "I",
        startRow: 4,
        percentage: 30,
      },
      [
        {
          id_produk: "local-1",
          nama_produk: "Teh Tarik",
          stok_saat_ini: 11,
          is_active: true,
          is_marketplace: true,
          marketplace_product_id: "PROD-1",
          marketplace_sku_id: "SKU-1",
          updatedAt: Date.now(),
        },
      ],
    );

    const updatedRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
      result.workbook.Sheets.Template,
      {
        header: 1,
        raw: true,
      },
    );

    expect(updatedRows[0][0]).toBe("header 1");
    expect(updatedRows[3][8]).toBe(4);
    expect(updatedRows[4][8]).toBe(0);
    expect(result.summary.totalRows).toBe(2);
    expect(result.summary.matchedRows).toBe(1);
    expect(result.summary.zeroedRows).toBe(1);
  });

  it("persists export config locally and falls back to defaults when storage is unavailable", () => {
    saveMarketplaceExportConfig({
      productIdColumn: "C",
      skuIdColumn: "F",
      stockColumn: "J",
      startRow: 6,
      percentage: 45,
    });

    expect(loadMarketplaceExportConfig()).toEqual({
      productIdColumn: "C",
      skuIdColumn: "F",
      stockColumn: "J",
      startRow: 6,
      percentage: 45,
    });

    const original = window.localStorage;
    Object.defineProperty(window, "localStorage", {
      value: undefined,
      configurable: true,
    });

    expect(loadMarketplaceExportConfig()).toEqual(DEFAULT_MARKETPLACE_EXPORT_CONFIG);

    Object.defineProperty(window, "localStorage", {
      value: original,
      configurable: true,
    });
  });
});
