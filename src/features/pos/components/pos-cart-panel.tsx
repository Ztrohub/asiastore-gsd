"use client";

import { cn } from "@/lib/utils";
import type { PosCartLine } from "@/features/pos/hooks/use-pos-cart";
import { formatCurrencyIdr } from "@/features/format/currency";

type Props = {
  lines: PosCartLine[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  onCashCheckout: () => void;
  onTransferCheckout: () => void;
  onVoidTransaction: () => void;
  focusMode: "products" | "cart";
  subtotal: number;
  itemDiscountTotal: number;
  orderDiscount: number;
  total: number;
  onOrderDiscountChange: (value: number) => void;
};

export function PosCartPanel({
  lines,
  activeIndex,
  onSelect,
  onCashCheckout,
  onTransferCheckout,
  onVoidTransaction,
  focusMode,
  subtotal,
  itemDiscountTotal,
  orderDiscount,
  total,
  onOrderDiscountChange,
}: Props) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border p-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:overflow-hidden",
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
        <div className="max-h-80 space-y-1 overflow-auto rounded-md border border-border/80 bg-background/40 p-1 xl:min-h-0 xl:flex-1 xl:max-h-none">
          {lines.map((line, idx) => (
            <button
              className={cn(
                "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 rounded px-2 py-2 text-left text-sm",
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
                <p className="text-[11px] text-muted-foreground">Tekan Enter untuk edit qty/subtotal item</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-xs font-medium">{formatCurrencyIdr(line.qty * line.harga_jual)}</p>
                <p className="text-[11px] text-muted-foreground">- {formatCurrencyIdr(line.line_discount)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Diskon total transaksi (IDR)</span>
        <input
          className="w-full rounded border border-input bg-background px-2 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          inputMode="numeric"
          onChange={(event) => onOrderDiscountChange(Number(event.target.value || "0"))}
          value={String(orderDiscount)}
        />
      </label>

      <div className="space-y-1 rounded-md border border-border/70 bg-muted/30 p-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal Keranjang</span>
          <span>{formatCurrencyIdr(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Diskon Item</span>
          <span>- {formatCurrencyIdr(itemDiscountTotal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Diskon Transaksi</span>
          <span>- {formatCurrencyIdr(orderDiscount)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border/80 pt-1 font-semibold">
          <span>Total</span>
          <span data-testid="cart-total">{formatCurrencyIdr(total)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="checkout-cash-button"
            disabled={lines.length === 0}
            onClick={onCashCheckout}
            type="button"
          >
            Tunai (F8)
          </button>
          <button
            className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="checkout-transfer-button"
            disabled={lines.length === 0}
            onClick={onTransferCheckout}
            type="button"
          >
            Transfer (F9)
          </button>
        </div>
        <button
          className="w-full rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="void-button"
          disabled={lines.length === 0}
          onClick={onVoidTransaction}
          type="button"
        >
          Void (F10)
        </button>
      </div>
    </div>
  );
}
