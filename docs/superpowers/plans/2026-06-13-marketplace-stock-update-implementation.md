# Marketplace Stock Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-only `Marketplace` inventory tab that updates stock values inside an uploaded `.xlsx` template using marketplace product IDs and SKU IDs from the local product catalog, then downloads the updated file without touching backend or inventory persistence.

**Architecture:** Keep the feature isolated to the inventory UI. Put workbook parsing, column mapping, row scanning, stock calculation, and browser-local config persistence into focused utilities and a dedicated tab component. `InventoryTabs` only gains a new tab button and panel, while existing product and stock-in flows remain unchanged.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, `xlsx` (SheetJS) for client-side workbook read/write

---

### Task 1: Add workbook transform and config persistence utilities with test-first coverage

**Files:**
- Create: `src/features/inventory/lib/marketplace-stock-template.ts`
- Create: `src/features/inventory/lib/marketplace-stock-config.ts`
- Create: `tests/inventory/marketplace-stock-template.spec.ts`

- [ ] **Step 1: Write the failing utility tests**

```ts
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
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

    const result = updateMarketplaceWorkbookStock(workbook, {
      productIdColumn: "B",
      skuIdColumn: "E",
      stockColumn: "I",
      startRow: 4,
      percentage: 30,
    }, [
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
    ]);

    const updatedRows = XLSX.utils.sheet_to_json<(string | number | null)[]>(result.workbook.Sheets.Template, {
      header: 1,
      raw: true,
    });

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
```

- [ ] **Step 2: Run the utility test to verify it fails**

Run: `pnpm exec vitest run tests/inventory/marketplace-stock-template.spec.ts --reporter=verbose`

Expected: FAIL because the marketplace stock utility module does not exist yet and no transform/config helpers are implemented.

- [ ] **Step 3: Write the minimal utility implementation**

```ts
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
  return Math.ceil(Math.max(0, stock) * Math.max(0, percentage) / 100);
}

export function updateMarketplaceWorkbookStock(
  workbook: XLSX.WorkBook,
  config: MarketplaceExportConfig,
  products: ProductRecord[],
) {
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: true });
  const productIdIndex = columnLabelToIndex(config.productIdColumn);
  const skuIdIndex = columnLabelToIndex(config.skuIdColumn);
  const stockIndex = columnLabelToIndex(config.stockColumn);
  const lookup = new Map(
    products
      .filter((product) => product.is_marketplace && product.marketplace_product_id && product.marketplace_sku_id)
      .map((product) => [
        `${String(product.marketplace_product_id).trim()}::${String(product.marketplace_sku_id).trim()}`,
        product,
      ]),
  );

  let totalRows = 0;
  let matchedRows = 0;
  let zeroedRows = 0;

  for (let rowIndex = Math.max(config.startRow - 1, 0); rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const productId = String(row[productIdIndex] ?? "").trim();
    const skuId = String(row[skuIdIndex] ?? "").trim();
    if (!productId && !skuId) continue;

    totalRows += 1;
    const product = lookup.get(`${productId}::${skuId}`);
    const stockValue = product
      ? calculateMarketplaceStockValue(product.stok_saat_ini, config.percentage)
      : 0;

    if (product) {
      matchedRows += 1;
    } else {
      zeroedRows += 1;
    }

    row[stockIndex] = stockValue;
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
```

```ts
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
    return raw ? { ...DEFAULT_MARKETPLACE_EXPORT_CONFIG, ...JSON.parse(raw) } : DEFAULT_MARKETPLACE_EXPORT_CONFIG;
  } catch {
    return DEFAULT_MARKETPLACE_EXPORT_CONFIG;
  }
}

export function saveMarketplaceExportConfig(config: MarketplaceExportConfig) {
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // local-only persistence is best effort
  }
}
```

- [ ] **Step 4: Re-run the utility test and verify it passes**

Run: `pnpm exec vitest run tests/inventory/marketplace-stock-template.spec.ts --reporter=verbose`

Expected: PASS with coverage for column parsing, percentage rounding, mismatch-to-zero, row protection before `startRow`, and browser-local config fallback.

- [ ] **Step 5: Commit the utility slice**

```bash
git add src/features/inventory/lib/marketplace-stock-template.ts src/features/inventory/lib/marketplace-stock-config.ts tests/inventory/marketplace-stock-template.spec.ts
git commit -m "feat: add marketplace workbook stock utilities"
```

### Task 2: Add the Marketplace tab UI with local config persistence and browser download flow

**Files:**
- Create: `src/features/inventory/components/marketplace-stock-tab.tsx`
- Modify: `src/features/inventory/components/inventory-tabs.tsx`
- Modify: `tests/inventory/inventory-product-tab.spec.tsx`

- [ ] **Step 1: Write the failing UI tests**

```tsx
it("renders a Marketplace tab beside Produk and Stock In", () => {
  render(<InventoryTabs />);

  expect(screen.getByRole("tab", { name: "Produk" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Stock In" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Marketplace" })).toBeInTheDocument();
});

it("loads default marketplace export config and restores saved local config", async () => {
  window.localStorage.setItem(
    "inventory.marketplace-export-config",
    JSON.stringify({
      productIdColumn: "C",
      skuIdColumn: "F",
      stockColumn: "J",
      startRow: 6,
      percentage: 45,
    }),
  );

  render(<InventoryTabs />);
  fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));

  expect(await screen.findByLabelText("Kolom ID Produk")).toHaveValue("C");
  expect(screen.getByLabelText("Kolom ID SKU")).toHaveValue("F");
  expect(screen.getByLabelText("Kolom Stok")).toHaveValue("J");
  expect(screen.getByLabelText("Start Row")).toHaveValue(6);
  expect(screen.getByLabelText("Persentase Stok")).toHaveValue(45);
});

it("blocks processing when no xlsx file is selected", async () => {
  render(<InventoryTabs />);
  fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
  fireEvent.click(await screen.findByRole("button", { name: "Proses & Download" }));

  expect(await screen.findByText("Pilih file .xlsx terlebih dahulu.")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: FAIL because the `Marketplace` tab and its form fields do not exist yet.

- [ ] **Step 3: Implement the isolated Marketplace tab component and integration**

```tsx
type TabKey = "produk" | "stock-in" | "marketplace";

export function MarketplaceStockTab({ products }: { products: ProductRecord[] }) {
  const [config, setConfig] = useState<MarketplaceExportConfig>(() => loadMarketplaceExportConfig());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketplaceExportResult | null>(null);

  useEffect(() => {
    saveMarketplaceExportConfig(config);
  }, [config]);

  async function handleProcess() {
    if (!file) {
      setError("Pilih file .xlsx terlebih dahulu.");
      return;
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const processed = updateMarketplaceWorkbookStock(workbook, config, products);
    const output = XLSX.write(processed.workbook, { type: "array", bookType: "xlsx" });
    const blob = new Blob([output], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const downloadUrl = URL.createObjectURL(blob);
    setResult({
      ...processed.summary,
      downloadUrl,
      fileName: file.name.replace(/\.xlsx$/i, "") + "-updated.xlsx",
    });
    setError(null);
  }

  return (
    <section className="space-y-4">
      <Input aria-label="File template marketplace" accept=".xlsx" type="file" />
      <Input aria-label="Kolom ID Produk" value={config.productIdColumn} />
      <Input aria-label="Kolom ID SKU" value={config.skuIdColumn} />
      <Input aria-label="Kolom Stok" value={config.stockColumn} />
      <Input aria-label="Start Row" type="number" value={config.startRow} />
      <Input aria-label="Persentase Stok" type="number" value={config.percentage} />
      <Button onClick={handleProcess}>Proses & Download</Button>
      {result ? <a download={result.fileName} href={result.downloadUrl}>Download Ulang</a> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Re-run the UI test and verify it passes**

Run: `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: PASS with the new tab rendered, persisted local config restored, and processing blocked without a file.

- [ ] **Step 5: Commit the UI slice**

```bash
git add src/features/inventory/components/marketplace-stock-tab.tsx src/features/inventory/components/inventory-tabs.tsx tests/inventory/inventory-product-tab.spec.tsx
git commit -m "feat: add marketplace stock export tab"
```

### Task 3: Add XLSX dependency, harden validation, and run final verification

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `src/features/inventory/components/marketplace-stock-tab.tsx`
- Modify: `tests/inventory/inventory-product-tab.spec.tsx`
- Test: `tests/inventory/marketplace-stock-template.spec.ts`

- [ ] **Step 1: Write the failing validation and download fallback tests**

```tsx
it("validates excel-style column labels and start row before processing", async () => {
  render(<InventoryTabs />);
  fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));

  fireEvent.change(await screen.findByLabelText("Kolom ID Produk"), {
    target: { value: "1B" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Proses & Download" }));

  expect(await screen.findByText("Kolom harus memakai format huruf Excel.")).toBeInTheDocument();
});

it("shows summary and download fallback after a successful process", async () => {
  const file = new File(["xlsx"], "template.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  render(<InventoryTabs />);
  fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
  fireEvent.change(await screen.findByLabelText("File template marketplace"), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole("button", { name: "Proses & Download" }));

  expect(await screen.findByText("Jumlah row diperiksa")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Download Ulang" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run: `pnpm exec vitest run tests/inventory/marketplace-stock-template.spec.ts tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: FAIL because validation messages, summary rendering, and download fallback are not fully implemented yet.

- [ ] **Step 3: Add the dependency and complete the minimal hardening**

```json
{
  "dependencies": {
    "xlsx": "^0.18.5"
  }
}
```

```tsx
function isValidExcelColumnLabel(value: string) {
  return /^[A-Za-z]+$/.test(value.trim());
}

if (!isValidExcelColumnLabel(config.productIdColumn) || !isValidExcelColumnLabel(config.skuIdColumn) || !isValidExcelColumnLabel(config.stockColumn)) {
  setError("Kolom harus memakai format huruf Excel.");
  return;
}

if (config.startRow < 1) {
  setError("Start Row harus 1 atau lebih.");
  return;
}

if (marketplaceProducts.length === 0) {
  setError("Belum ada produk marketplace di katalog lokal.");
  return;
}
```

- [ ] **Step 4: Re-run the targeted tests and verify they pass**

Run: `pnpm exec vitest run tests/inventory/marketplace-stock-template.spec.ts tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: PASS with working validation, success summary, and browser download fallback.

- [ ] **Step 5: Run full inventory verification**

Run: `pnpm exec vitest run tests/inventory --reporter=verbose`
Expected: PASS with no regressions in existing inventory coverage.

Run: `pnpm exec eslint src/features/inventory/components/inventory-tabs.tsx src/features/inventory/components/marketplace-stock-tab.tsx src/features/inventory/lib/marketplace-stock-template.ts src/features/inventory/lib/marketplace-stock-config.ts tests/inventory/inventory-product-tab.spec.tsx tests/inventory/marketplace-stock-template.spec.ts`
Expected: PASS with zero lint errors.

Run: `pnpm build`
Expected: PASS with a successful Next.js production build.

- [ ] **Step 6: Commit the dependency and hardening slice**

```bash
git add package.json pnpm-lock.yaml src/features/inventory/components/marketplace-stock-tab.tsx tests/inventory/inventory-product-tab.spec.tsx tests/inventory/marketplace-stock-template.spec.ts
git commit -m "feat: finalize marketplace stock xlsx export flow"
```
