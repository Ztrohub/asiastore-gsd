"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { PosCartLine } from "@/features/pos/hooks/use-pos-cart";
import { normalizeQuantityInput } from "@/lib/inventory/quantity";

type Props = {
  open: boolean;
  line?: PosCartLine;
  onClose: () => void;
  onDelete: () => void;
  onConfirm: (payload: { qty: number; finalSubtotal: number }) => void;
};

export function PosCartItemDialog({ open, line, onClose, onDelete, onConfirm }: Props) {
  const [qtyInput, setQtyInput] = useState(line ? String(line.qty) : "1");
  const [finalSubtotalInput, setFinalSubtotalInput] = useState(
    line ? String(Math.max(0, line.harga_jual * line.qty - line.line_discount)) : "0",
  );
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const unitPrice = line?.harga_jual ?? 0;
  const qtyPreview = Number(qtyInput || "0");
  const baseSubtotal = unitPrice * (Number.isFinite(qtyPreview) ? qtyPreview : 0);

  function submit() {
    const qty = normalizeQuantityInput(qtyInput);
    const finalSubtotal = Math.max(0, Math.trunc(Number(finalSubtotalInput || "0")));
    onConfirm({ qty, finalSubtotal });
  }

  useEffect(() => {
    if (!open) return;
    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
  }, [open]);

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Edit Item Keranjang</DialogTitle>
          <DialogDescription>{line?.nama_produk ?? "Item"}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          <p>
            Harga satuan: <span className="font-medium">{formatCurrencyIdr(unitPrice)}</span>
          </p>
          <p>
            Subtotal sebelum diskon:{" "}
            <span className="font-medium">{formatCurrencyIdr(Math.max(0, baseSubtotal))}</span>
          </p>
        </div>

        <label className="space-y-1 text-sm">
          <span>Qty</span>
          <Input
            aria-label="Qty Item Keranjang"
            autoFocus
            inputMode="decimal"
            onChange={(event) => setQtyInput(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                submit();
              }
            }}
            ref={qtyInputRef}
            value={qtyInput}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Subtotal akhir item (setelah diskon)</span>
          <Input
            aria-label="Subtotal Akhir Item"
            inputMode="numeric"
            onChange={(event) => setFinalSubtotalInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                submit();
              }
            }}
            value={finalSubtotalInput}
          />
        </label>

        <DialogFooter>
          <Button onClick={onDelete} type="button" variant="destructive">
            Hapus
          </Button>
          <Button onClick={onClose} type="button" variant="outline">
            Batal
          </Button>
          <Button onClick={submit} type="button">
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
