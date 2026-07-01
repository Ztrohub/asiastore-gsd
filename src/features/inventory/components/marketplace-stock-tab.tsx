"use client";

import { useEffect, useState } from "react";
import ExcelJS from "exceljs";
import type { ProductRecord } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasMarketplaceListings } from "@/lib/inventory/marketplace";
import {
  loadMarketplaceExportConfig,
  saveMarketplaceExportConfig,
  type MarketplaceExportConfig,
} from "@/features/inventory/lib/marketplace-stock-config";
import { updateMarketplaceWorkbookStock } from "@/features/inventory/lib/marketplace-stock-template";

type Props = {
  products: ProductRecord[];
};

type ProcessResult = {
  totalRows: number;
  matchedRows: number;
  zeroedRows: number;
  downloadUrl: string;
  fileName: string;
};

export function MarketplaceStockTab({ products }: Props) {
  const [config, setConfig] = useState<MarketplaceExportConfig>(() => loadMarketplaceExportConfig());
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);

  useEffect(() => {
    saveMarketplaceExportConfig(config);
  }, [config]);

  useEffect(() => {
    return () => {
      if (result?.downloadUrl) {
        URL.revokeObjectURL(result.downloadUrl);
      }
    };
  }, [result]);

  async function handleProcess() {
    if (!isValidExcelColumnLabel(config.skuIdColumn) ||
      !isValidExcelColumnLabel(config.stockColumn)
    ) {
      setError("Kolom harus memakai format huruf Excel.");
      return;
    }

    if (!file) {
      setError("Pilih file .xlsx terlebih dahulu.");
      return;
    }

    if (config.startRow < 1) {
      setError("Start Row harus 1 atau lebih.");
      return;
    }

    if (config.percentage < 0) {
      setError("Persentase Stok harus 0 atau lebih.");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setError("File harus berformat .xlsx.");
      return;
    }

    const marketplaceProducts = products.filter((product) => hasMarketplaceListings(product));

    if (marketplaceProducts.length === 0) {
      setError("Belum ada produk marketplace di katalog lokal.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const processed = updateMarketplaceWorkbookStock(workbook, config, marketplaceProducts);
      const output = await processed.workbook.xlsx.writeBuffer();
      const blob = new Blob([output], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const downloadUrl = URL.createObjectURL(blob);
      const fileName = file.name.replace(/\.xlsx$/i, "") + "-updated.xlsx";

      if (result?.downloadUrl) {
        URL.revokeObjectURL(result.downloadUrl);
      }

      setResult({
        ...processed.summary,
        downloadUrl,
        fileName,
      });
      setError(null);

      if (typeof document !== "undefined") {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        link.click();
      }
    } catch {
      setError("File template marketplace tidak bisa diproses.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="marketplace-template-file">
          File template marketplace
        </label>
        <Input
          accept=".xlsx"
          aria-label="File template marketplace"
          id="marketplace-template-file"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
          type="file"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ConfigField
          label="Kolom ID SKU"
          onChange={(value) => setConfig((current) => ({ ...current, skuIdColumn: value }))}
          value={config.skuIdColumn}
        />
        <ConfigField
          label="Kolom Stok"
          onChange={(value) => setConfig((current) => ({ ...current, stockColumn: value }))}
          value={config.stockColumn}
        />
        <ConfigNumberField
          label="Start Row"
          onChange={(value) => setConfig((current) => ({ ...current, startRow: value }))}
          value={config.startRow}
        />
        <ConfigNumberField
          label="Persentase Stok"
          onChange={(value) => setConfig((current) => ({ ...current, percentage: value }))}
          value={config.percentage}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Produk marketplace lokal tersedia: {products.filter((product) => hasMarketplaceListings(product)).length}
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="space-y-1 rounded-lg border border-border p-3 text-sm">
          <p>Jumlah row diperiksa: {result.totalRows}</p>
          <p>Jumlah row match: {result.matchedRows}</p>
          <p>Jumlah row diisi 0: {result.zeroedRows}</p>
          <p>File hasil: {result.fileName}</p>
          <a className="text-primary underline-offset-4 hover:underline" download={result.fileName} href={result.downloadUrl}>
            Download Ulang
          </a>
        </div>
      ) : null}

      <Button onClick={handleProcess} type="button">
        Proses & Download
      </Button>
    </section>
  );
}

function isValidExcelColumnLabel(value: string) {
  return /^[A-Za-z]+$/.test(value.trim());
}

function ConfigField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-label={label}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}

function ConfigNumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-label={label}
        id={id}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        type="number"
        value={value}
      />
    </div>
  );
}
