"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getDialogActionButtonClass,
  isDialogActionNavigationTarget,
  useDialogActionNavigation,
} from "@/components/ui/dialog-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrencyIdr } from "@/features/format/currency";
import {
  computeCheckoutTotals,
  type CheckoutLineInput,
  type PosPaymentMethod,
} from "@/features/pos/hooks/use-pos-checkout";

type PosPaymentDialogProps = {
  open: boolean;
  lines: CheckoutLineInput[];
  orderDiscount: number;
  paymentMethod: PosPaymentMethod;
  onClose: () => void;
  onSubmit: (payload: { amountReceived?: number }) => Promise<void> | void;
};

export function PosPaymentDialog({
  open,
  lines,
  orderDiscount,
  paymentMethod,
  onClose,
  onSubmit,
}: PosPaymentDialogProps) {
  const [amountReceivedInput, setAmountReceivedInput] = useState(
    String(computeCheckoutTotals(lines, orderDiscount).total),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const { moveSelectedAction, registerActionRef, selectedAction, setSelectedAction } =
    useDialogActionNavigation({
      actions: ["cancel", "confirm"] as const,
      defaultAction: "confirm",
    });

  const totals = useMemo(() => computeCheckoutTotals(lines, orderDiscount), [lines, orderDiscount]);
  const rawAmountReceived = Math.max(0, Math.trunc(Number(amountReceivedInput || "0")));
  const change = Math.max(0, rawAmountReceived - totals.total);

  const submit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      if (paymentMethod === "cash" && rawAmountReceived < totals.total) {
        setError("Nominal kurang");
        return;
      }
      await onSubmit({
        amountReceived: paymentMethod === "cash" ? rawAmountReceived : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout gagal");
    } finally {
      setSubmitting(false);
    }
  };

  const submitSelectedAction = () => {
    if (selectedAction === "confirm") {
      submit().catch(() => undefined);
      return;
    }
    onClose();
  };

  return (
    <Dialog onOpenChange={(state) => !state && onClose()} open={open}>
      <DialogContent
        onKeyDown={(event) => {
          if (
            (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
            isDialogActionNavigationTarget(event.target)
          ) {
            event.preventDefault();
            event.stopPropagation();
            moveSelectedAction(event.key === "ArrowRight" ? 1 : -1);
            return;
          }
          if (event.key === "Enter" && isDialogActionNavigationTarget(event.target)) {
            event.preventDefault();
            event.stopPropagation();
            submitSelectedAction();
          }
        }}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{paymentMethod === "cash" ? "Pembayaran Tunai" : "Pembayaran Transfer"}</DialogTitle>
          <DialogDescription>
            Periksa item transaksi lalu proses pembayaran.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-52 space-y-1 overflow-auto rounded-md border border-border bg-background/40 p-2 text-sm">
          {lines.map((line) => (
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded border border-border/70 p-2"
              key={line.id_produk}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{line.nama_produk}</p>
                <p className="text-xs text-muted-foreground">
                  {line.qty} x {formatCurrencyIdr(line.unit_price)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs">{formatCurrencyIdr(line.qty * line.unit_price)}</p>
                {(line.line_discount ?? 0) > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    - {formatCurrencyIdr(line.line_discount ?? 0)}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatCurrencyIdr(totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Diskon Item</span>
            <span>- {formatCurrencyIdr(totals.itemDiscount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Diskon Total</span>
            <span>- {formatCurrencyIdr(totals.orderDiscount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border/80 pt-1 font-semibold">
            <span>Total</span>
            <span>{formatCurrencyIdr(totals.total)}</span>
          </div>
        </div>

        {paymentMethod === "cash" ? (
          <div className="space-y-1">
            <label className="space-y-1 text-sm">
              <span>Uang diterima</span>
              <Input
                autoFocus
                inputMode="numeric"
                onChange={(event) => setAmountReceivedInput(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submit().catch(() => undefined);
                  }
                }}
                ref={amountInputRef}
                value={amountReceivedInput}
              />
            </label>
            <p className="text-sm">Kembalian: {formatCurrencyIdr(change)}</p>
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <p>Nominal transfer: {formatCurrencyIdr(totals.total)}</p>
            <p className="text-xs text-muted-foreground">Tekan Enter pada tombol proses untuk simpan.</p>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            className={getDialogActionButtonClass({
              selected: selectedAction === "cancel",
              variant: "outline",
            })}
            onClick={onClose}
            onFocus={() => setSelectedAction("cancel")}
            ref={registerActionRef("cancel")}
            type="button"
            variant="outline"
          >
            Batal
          </Button>
          <Button
            autoFocus={paymentMethod !== "cash"}
            className={getDialogActionButtonClass({
              selected: selectedAction === "confirm",
              variant: "solid",
            })}
            disabled={submitting}
            onClick={() => submit().catch(() => undefined)}
            onFocus={() => setSelectedAction("confirm")}
            ref={registerActionRef("confirm")}
            type="button"
          >
            Proses transaksi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
