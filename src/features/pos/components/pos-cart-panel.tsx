"use client";

import { cn } from "@/lib/utils";
import type { PosCartLine } from "@/features/pos/hooks/use-pos-cart";
import { formatCurrencyIdr } from "@/features/format/currency";

type Props = {
  lines: PosCartLine[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  focusMode: "products" | "cart";
};

export function PosCartPanel({
  lines,
  activeIndex,
  onSelect,
  focusMode,
}: Props) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-3 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-hidden",
        focusMode === "cart" ? "border-white ring-2 ring-white/80" : "border-border",
      )}
      data-testid="cart-panel"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Keranjang</p>
        <p className="text-xs text-muted-foreground">{lines.length} item</p>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          Belum ada item.
        </p>
      ) : (
        <div
          className="max-h-80 space-y-1 overflow-auto rounded-md border border-border/80 bg-background/40 p-1 lg:min-h-0 lg:flex-1 lg:max-h-none"
          data-testid="cart-list"
        >
          {lines.map((line, idx) => (
            <button
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded px-2 py-1.5 text-left text-sm",
                focusMode === "cart" && activeIndex === idx
                  ? "bg-primary/10 ring-2 ring-white"
                  : "hover:bg-muted",
              )}
              data-active={focusMode === "cart" && activeIndex === idx ? "true" : "false"}
              data-testid={`cart-row-${idx}`}
              key={line.id_produk}
              onClick={() => onSelect(idx)}
              type="button"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-medium">{line.nama_produk}</p>
                <p className="text-xs text-muted-foreground">
                  {line.qty} x {formatCurrencyIdr(line.harga_jual)}
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs font-medium">{formatCurrencyIdr(line.qty * line.harga_jual)}</p>
                <p className="text-[11px] text-muted-foreground">- {formatCurrencyIdr(line.line_discount)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
