"use client";

import { cn } from "@/lib/utils";
import type { ProductRecord } from "@/lib/offline/db";

type Props = {
  products: ProductRecord[];
  activeIndex: number;
  focusMode: "products" | "cart";
  onSelect: (index: number) => void;
  onSubmit: (product: ProductRecord) => void;
};

export function PosProductTable({ products, activeIndex, focusMode, onSelect, onSubmit }: Props) {
  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Produk tidak ditemukan
      </div>
    );
  }

  return (
    <div className="max-h-[26rem] overflow-auto rounded-lg border border-border" data-testid="product-table">
      {products.map((product, idx) => (
        <button
          className={cn(
            "flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm",
            focusMode === "products" && activeIndex === idx
              ? "bg-primary/10 ring-2 ring-white"
              : "hover:bg-muted/60",
          )}
          data-active={focusMode === "products" && activeIndex === idx ? "true" : "false"}
          data-testid={`product-row-${idx}`}
          key={product.id_produk}
          onClick={() => onSelect(idx)}
          onDoubleClick={() => onSubmit(product)}
          type="button"
        >
          <span>{product.nama_produk}</span>
          <span className="text-muted-foreground">Rp{product.harga_jual.toLocaleString("id-ID")}</span>
        </button>
      ))}
    </div>
  );
}
