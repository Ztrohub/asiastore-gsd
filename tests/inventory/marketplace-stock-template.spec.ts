import ExcelJS from "exceljs";
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
    expect(calculateMarketplaceStockValue(-8, 30)).toBe(0);
  });

  it("updates only stock cells from the configured start row onward using marketplace sku matching", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");

    sheet.addRow(["header 1"]);
    sheet.addRow(["header 2"]);
    sheet.addRow(["header 3"]);
    sheet.addRow([null, "ANY-PRODUCT-ID", null, null, "SKU-1", null, null, null, 99]);
    sheet.addRow([null, "OTHER-ID", null, null, "SKU-404", null, null, null, 99]);

    const result = updateMarketplaceWorkbookStock(
      workbook,
      {
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
          marketplace_sku_id: "SKU-1",
          updatedAt: Date.now(),
        },
      ],
    );
    const output = await result.workbook.xlsx.writeBuffer();
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(output as ArrayBuffer);

    expect(reloaded.getWorksheet("Template")?.getCell("A1").value).toBe("header 1");
    expect(reloaded.getWorksheet("Template")?.getCell("I4").value).toBe(4);
    expect(reloaded.getWorksheet("Template")?.getCell("I5").value).toBe(0);
    expect(result.summary.totalRows).toBe(2);
    expect(result.summary.matchedRows).toBe(1);
    expect(result.summary.zeroedRows).toBe(1);
  });

  it("preserves worksheet styling after workbook serialization", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");

    sheet.addRow(["header 1"]);
    sheet.addRow(["header 2"]);
    sheet.addRow(["header 3"]);
    sheet.addRow([null, "ANY-PRODUCT-ID", null, null, "SKU-1", null, null, null, 99]);
    sheet.getColumn(9).width = 24;
    sheet.mergeCells("A1:C1");
    sheet.getCell("I4").font = { bold: true, color: { argb: "FFFF0000" } };

    const result = updateMarketplaceWorkbookStock(
      workbook,
      {
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
          marketplace_sku_id: "SKU-1",
          updatedAt: Date.now(),
        },
      ],
    );
    const output = await result.workbook.xlsx.writeBuffer();
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(output as ArrayBuffer);
    const updatedSheet = reloaded.getWorksheet("Template");

    expect(updatedSheet?.getColumn(9).width).toBe(24);
    expect(updatedSheet?.getCell("A1").isMerged).toBe(true);
    expect(updatedSheet?.getCell("I4").value).toBe(4);
    expect(updatedSheet?.getCell("I4").font).toMatchObject({
      bold: true,
      color: { argb: "FFFF0000" },
    });
  });

  it("writes zero when matched product stock is negative", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");

    sheet.addRow(["header 1"]);
    sheet.addRow(["header 2"]);
    sheet.addRow(["header 3"]);
    sheet.addRow([null, "OUTDATED-ID", null, null, "SKU-NEG", null, null, null, 99]);

    const result = updateMarketplaceWorkbookStock(
      workbook,
      {
        skuIdColumn: "E",
        stockColumn: "I",
        startRow: 4,
        percentage: 30,
      },
      [
        {
          id_produk: "local-neg",
          nama_produk: "Produk Minus",
          stok_saat_ini: -5,
          is_active: true,
          is_marketplace: true,
          marketplace_sku_id: "SKU-NEG",
          updatedAt: Date.now(),
        },
      ],
    );

    expect(result.workbook.getWorksheet("Template")?.getCell("I4").value).toBe(0);
    expect(result.summary.matchedRows).toBe(1);
    expect(result.summary.zeroedRows).toBe(0);
  });

  it("uses large-unit marketplace sku with large-unit stock when matched", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");

    sheet.addRow(["header 1"]);
    sheet.addRow(["header 2"]);
    sheet.addRow(["header 3"]);
    sheet.addRow([null, "UNUSED-PRODUCT-ID", null, null, "SKU-DUS", null, null, null, 99]);

    const result = updateMarketplaceWorkbookStock(
      workbook,
      {
        skuIdColumn: "E",
        stockColumn: "I",
        startRow: 4,
        percentage: 30,
      },
      [
        {
          id_produk: "local-large",
          nama_produk: "Produk Dus",
          stok_saat_ini: 120,
          stok_unit_besar_saat_ini: 2,
          is_active: true,
          is_marketplace: true,
          marketplace_sku_id: "SKU-PCS",
          marketplace_large_sku_id: "SKU-DUS",
          updatedAt: Date.now(),
        },
      ] as never,
    );

    expect(result.workbook.getWorksheet("Template")?.getCell("I4").value).toBe(1);
    expect(result.summary.matchedRows).toBe(1);
    expect(result.summary.zeroedRows).toBe(0);
  });

  it("uses derived package stock when marketplace sku belongs to a package", () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");

    sheet.addRow(["header 1"]);
    sheet.addRow(["header 2"]);
    sheet.addRow(["header 3"]);
    sheet.addRow([null, null, null, null, "SKU-PKT-A", null, null, null, 0]);

    const result = updateMarketplaceWorkbookStock(
      workbook,
      { skuIdColumn: "E", stockColumn: "I", startRow: 4, percentage: 30 },
      [
        {
          id_produk: "pkg-1",
          nama_produk: "Paket A",
          harga_jual: 79000,
          stok_saat_ini: 4,
          is_active: true,
          is_marketplace: true,
          marketplace_product_name: "Paket A Marketplace",
          marketplace_sku_id: "SKU-PKT-A",
          product_kind: "PACKAGE",
          unit_small_name: "paket",
          updatedAt: Date.now(),
        },
      ] as never,
    );

    expect(result.workbook.getWorksheet("Template")?.getCell("I4").value).toBe(2);
  });

  it("persists export config locally and falls back to defaults when storage is unavailable", () => {
    saveMarketplaceExportConfig({
      skuIdColumn: "F",
      stockColumn: "J",
      startRow: 6,
      percentage: 45,
    });

    expect(loadMarketplaceExportConfig()).toEqual({
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
