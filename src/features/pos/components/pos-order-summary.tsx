"use client";

import { formatCurrencyIdr } from "@/features/format/currency";
import type { CheckoutLineInput } from "@/features/pos/hooks/use-pos-checkout";

type PosOrderSummaryProps = {
  lines: CheckoutLineInput[];
  itemDiscount: number;
  orderDiscount: number;
  subtotal: number;
  total: number;
};

export function PosOrderSummary({
  lines,
  itemDiscount,
  orderDiscount,
  subtotal,
  total,
}: PosOrderSummaryProps) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/20 p-3 text-sm">
      <div className="flex justify-between">
        <span>Jumlah item</span>
        <span>{lines.length}</span>
      </div>
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatCurrencyIdr(subtotal)}</span>
      </div>
      <div className="flex justify-between">
        <span>Diskon item</span>
        <span>- {formatCurrencyIdr(itemDiscount)}</span>
      </div>
      <div className="flex justify-between">
        <span>Diskon transaksi</span>
        <span>- {formatCurrencyIdr(orderDiscount)}</span>
      </div>
      <div className="flex justify-between border-t border-border pt-1 font-semibold">
        <span>Total</span>
        <span>{formatCurrencyIdr(total)}</span>
      </div>
    </div>
  );
}
