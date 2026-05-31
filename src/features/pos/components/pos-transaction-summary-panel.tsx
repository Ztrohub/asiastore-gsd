"use client";

import { formatCurrencyIdr } from "@/features/format/currency";

type Props = {
  itemCount: number;
  subtotal: number;
  itemDiscountTotal: number;
  orderDiscount: number;
  total: number;
  note: string;
  onNoteChange: (value: string) => void;
  onOrderDiscountChange: (value: number) => void;
  onCashCheckout: () => void;
  onTransferCheckout: () => void;
  onVoidTransaction: () => void;
};

export function PosTransactionSummaryPanel({
  itemCount,
  subtotal,
  itemDiscountTotal,
  orderDiscount,
  total,
  note,
  onNoteChange,
  onOrderDiscountChange,
  onCashCheckout,
  onTransferCheckout,
  onVoidTransaction,
}: Props) {
  const disabled = itemCount === 0;

  return (
    <div
      className="space-y-3 rounded-lg border border-border p-3 xl:flex xl:min-h-0 xl:flex-col"
      data-testid="transaction-summary-panel"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Ringkasan</p>
        <p className="text-xs text-muted-foreground">{itemCount} item</p>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Diskon total transaksi (IDR)</span>
        <input
          className="w-full rounded border border-input bg-background px-2 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="order-discount-input"
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

      <label className="space-y-1 text-sm xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
        <span>Catatan transaksi (opsional)</span>
        <textarea
          className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring xl:min-h-[7rem] xl:flex-1"
          data-testid="transaction-note"
          onChange={(event) => onNoteChange(event.target.value)}
          value={note}
        />
      </label>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="checkout-cash-button"
            disabled={disabled}
            onClick={onCashCheckout}
            type="button"
          >
            Tunai (F8)
          </button>
          <button
            className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="checkout-transfer-button"
            disabled={disabled}
            onClick={onTransferCheckout}
            type="button"
          >
            Transfer (F9)
          </button>
        </div>
        <button
          className="w-full rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="void-button"
          disabled={disabled}
          onClick={onVoidTransaction}
          type="button"
        >
          Void (F10)
        </button>
      </div>
    </div>
  );
}
