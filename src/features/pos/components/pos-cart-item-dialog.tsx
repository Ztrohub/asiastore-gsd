"use client";

import { useEffect, useRef, useState } from "react";
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
import type { PosCartLine } from "@/features/pos/hooks/use-pos-cart";
import { normalizeQuantityInput } from "@/lib/inventory/quantity";

type Props = {
  open: boolean;
  line?: PosCartLine;
  onClose: () => void;
  onDelete: () => void;
  onConfirm: (payload: { qty: number; finalSubtotal: number }) => void;
};

function getFinalSubtotal(line?: PosCartLine) {
  if (!line) return 0;
  return Math.max(0, Math.trunc(line.harga_jual * line.qty - line.line_discount));
}

function hasSubtotalOverride(line?: PosCartLine) {
  if (!line) return false;
  return getFinalSubtotal(line) !== Math.max(0, Math.trunc(line.harga_jual * line.qty));
}

export function PosCartItemDialog({ open, line, onClose, onDelete, onConfirm }: Props) {
  const [qtyInput, setQtyInput] = useState(line ? String(line.qty) : "1");
  const [finalSubtotalInput, setFinalSubtotalInput] = useState(String(getFinalSubtotal(line)));
  const [hasManualSubtotalOverride, setHasManualSubtotalOverride] = useState(hasSubtotalOverride(line));
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const { moveSelectedAction, registerActionRef, selectedAction, setSelectedAction } =
    useDialogActionNavigation({
      actions: ["delete", "cancel", "save"] as const,
      defaultAction: "save",
    });

  const unitPrice = line?.harga_jual ?? 0;
  const qtyPreview = Number(qtyInput || "0");
  const baseSubtotal = unitPrice * (Number.isFinite(qtyPreview) ? qtyPreview : 0);

  function submit() {
    const qty = normalizeQuantityInput(qtyInput);
    const finalSubtotal = Math.max(0, Math.trunc(Number(finalSubtotalInput || "0")));
    onConfirm({ qty, finalSubtotal });
  }

  function submitSelectedAction() {
    if (selectedAction === "delete") {
      onDelete();
      return;
    }
    if (selectedAction === "save") {
      submit();
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    qtyInputRef.current?.focus();
    qtyInputRef.current?.select();
  }, [open]);

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent
        onKeyDown={(event) => {
          if (event.key === "Delete") {
            event.preventDefault();
            event.stopPropagation();
            onDelete();
            return;
          }
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
            onChange={(event) => {
              const nextQtyInput = event.target.value;
              setQtyInput(nextQtyInput);
              if (hasManualSubtotalOverride) return;
              const nextQtyPreview = Number(nextQtyInput || "0");
              const nextBaseSubtotal = unitPrice * (Number.isFinite(nextQtyPreview) ? nextQtyPreview : 0);
              setFinalSubtotalInput(String(Math.max(0, Math.trunc(nextBaseSubtotal))));
            }}
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
            onChange={(event) => {
              const nextValue = event.target.value;
              setFinalSubtotalInput(nextValue);
              const normalizedSubtotal = Math.max(0, Math.trunc(Number(nextValue || "0")));
              setHasManualSubtotalOverride(normalizedSubtotal !== Math.max(0, Math.trunc(baseSubtotal)));
            }}
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
          <Button
            className={getDialogActionButtonClass({
              selected: selectedAction === "delete",
              variant: "solid",
            })}
            onClick={onDelete}
            onFocus={() => setSelectedAction("delete")}
            ref={registerActionRef("delete")}
            type="button"
            variant="destructive"
          >
            Hapus
          </Button>
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
            className={getDialogActionButtonClass({
              selected: selectedAction === "save",
              variant: "solid",
            })}
            onClick={submit}
            onFocus={() => setSelectedAction("save")}
            ref={registerActionRef("save")}
            type="button"
          >
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
