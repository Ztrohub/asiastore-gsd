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
import type { InventoryMutationUnit } from "@/lib/offline/db";
import type { ProductSellUnitOption } from "@/features/pos/lib/product-units";
import { formatCurrencyIdr } from "@/features/format/currency";

type Props = {
  open: boolean;
  defaultQty?: string;
  productName?: string;
  unitOptions: ProductSellUnitOption[];
  defaultUnitMutasi: InventoryMutationUnit;
  onClose: () => void;
  onConfirm: (payload: { qty: string; unit_mutasi: InventoryMutationUnit }) => void;
};

export function PosQtyDialog({
  open,
  defaultQty = "1",
  productName,
  unitOptions,
  defaultUnitMutasi,
  onClose,
  onConfirm,
}: Props) {
  const [qty, setQty] = useState(defaultQty);
  const [unitMutasi, setUnitMutasi] = useState<InventoryMutationUnit>(defaultUnitMutasi);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const activeUnitIndex = Math.max(
    0,
    unitOptions.findIndex((item) => item.unit_mutasi === unitMutasi),
  );

  function moveUnit(delta: number) {
    if (unitOptions.length <= 1) return;
    const nextIndex = (activeUnitIndex + delta + unitOptions.length) % unitOptions.length;
    setUnitMutasi(unitOptions[nextIndex].unit_mutasi);
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
          <DialogTitle>Qty Item</DialogTitle>
          <DialogDescription>{productName ?? "Produk"}</DialogDescription>
        </DialogHeader>

        {unitOptions.length > 1 ? (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Pilih unit</p>
            <div className="grid grid-cols-2 gap-2">
              {unitOptions.map((unit) => (
                <button
                  className={`rounded border px-2 py-2 text-left text-sm transition ${
                    unit.unit_mutasi === unitMutasi
                      ? "border-white bg-primary/10 ring-2 ring-white"
                      : "border-border hover:bg-muted"
                  }`}
                  key={unit.unit_mutasi}
                  onClick={() => setUnitMutasi(unit.unit_mutasi)}
                  type="button"
                >
                  <p className="font-medium">{unit.unit_label}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrencyIdr(unit.unit_price)}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Input
          aria-label="Qty"
          autoFocus
          inputMode="decimal"
          onChange={(event) => setQty(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              event.stopPropagation();
              moveUnit(-1);
              return;
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              event.stopPropagation();
              moveUnit(1);
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              onConfirm({ qty, unit_mutasi: unitMutasi });
            }
          }}
          ref={qtyInputRef}
          value={qty}
        />
        <DialogFooter>
          <Button onClick={onClose} type="button" variant="outline">
            Batal
          </Button>
          <Button onClick={() => onConfirm({ qty, unit_mutasi: unitMutasi })} type="button">
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
