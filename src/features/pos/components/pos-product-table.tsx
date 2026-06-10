"use client";

import { cn } from "@/lib/utils";
import { formatQuantityForDisplay } from "@/lib/inventory/quantity";
import { getLargeUnitName, getSmallUnitName } from "@/lib/inventory/uom";
import type { ProductRecord } from "@/lib/offline/db";
import {
  getProductMatchIndices,
  highlightMatchedText,
  type ProductSearchResult,
} from "@/lib/search/product-fuzzy-search";

type Props = {
  results: ProductSearchResult[];
  activeIndex: number;
  focusMode: "products" | "cart";
  onSelect: (index: number) => void;
  onSubmit: (product: ProductRecord) => void;
};

export function PosProductTable({ results, activeIndex, focusMode, onSelect, onSubmit }: Props) {
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Produk tidak ditemukan
      </div>
    );
  }

  return (
    <div
      className="max-h-[26rem] overflow-auto rounded-lg border border-border lg:min-h-0 lg:flex-1 lg:max-h-none"
      data-testid="product-table"
    >
      {results.map((result, idx) => (
        <button
          className={cn(
            "flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm",
            focusMode === "products" && activeIndex === idx
              ? "bg-primary/10 ring-2 ring-white"
              : "hover:bg-muted/60",
          )}
          data-active={focusMode === "products" && activeIndex === idx ? "true" : "false"}
          data-testid={`product-row-${idx}`}
          key={result.product.id_produk}
          onClick={() => onSelect(idx)}
          onDoubleClick={() => onSubmit(result.product)}
          type="button"
        >
          <span className="min-w-0 flex-1">
            <span className="block">
              {highlightMatchedText(
                result.product.nama_produk,
                getProductMatchIndices(result.matches, "nama_produk"),
              )}
            </span>
            <span className="block text-xs text-muted-foreground">
              {getStockLabel(result.product)}
            </span>
          </span>
          <span className="pl-3 text-right text-muted-foreground">
            Rp{result.product.harga_jual.toLocaleString("id-ID")}
          </span>
        </button>
      ))}
    </div>
  );
}

function getStockLabel(product: ProductRecord) {
  const smallStock = `${formatQuantityForDisplay(product.stok_saat_ini)} ${getSmallUnitName(product)}`;
  const largeUnitName = getLargeUnitName(product);

  if (!largeUnitName) {
    return `Stok: ${smallStock}`;
  }

  const largeStock = formatQuantityForDisplay(product.stok_unit_besar_saat_ini ?? 0);
  return `Stok: ${smallStock} | ${largeStock} ${largeUnitName}`;
}
