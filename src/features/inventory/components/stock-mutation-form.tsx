"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStockMutation } from "@/features/inventory/hooks/use-stock-mutation";
import { NegativeStockWarning } from "@/features/inventory/components/negative-stock-warning";

type Props = {
  productId: string;
  currentStock: number;
  transactionId: string;
  logicalClock: number;
};

export function StockMutationForm({
  productId,
  currentStock,
  transactionId,
  logicalClock,
}: Props) {
  const { submitMutation, submitting, error } = useStockMutation();
  const [qty, setQty] = useState("1");
  const [jenisMutasi, setJenisMutasi] = useState<"STOCK_IN" | "STOCK_ADJUSTMENT">("STOCK_IN");
  const [warningOpen, setWarningOpen] = useState(false);

  const quantity = Number(qty) || 0;
  const deltaQuantity = jenisMutasi === "STOCK_IN" ? Math.abs(quantity) : -Math.abs(quantity);
  const projectedStock = currentStock + deltaQuantity;
  const shouldWarn = currentStock <= 0 || projectedStock <= 0;

  async function commit() {
    await submitMutation({
      jenis_mutasi: jenisMutasi,
      id_transaksi: transactionId,
      id_produk: productId,
      delta_qty: deltaQuantity,
      logical_clock: logicalClock,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (shouldWarn) {
      setWarningOpen(true);
      return;
    }
    await commit();
  }

  return (
    <>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="jenis-mutasi">
            Jenis mutasi
          </label>
          <select
            id="jenis-mutasi"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5"
            value={jenisMutasi}
            onChange={(event) => setJenisMutasi(event.target.value as "STOCK_IN" | "STOCK_ADJUSTMENT")}
          >
            <option value="STOCK_IN">Stock In</option>
            <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="qty-mutasi">
            Qty
          </label>
          <Input
            id="qty-mutasi"
            value={qty}
            onChange={(event) => setQty(event.target.value)}
            type="number"
            min={1}
            required
          />
        </div>
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button className="w-full" disabled={submitting} type="submit">
          {submitting ? "Menyimpan..." : "Simpan Mutasi Stok"}
        </Button>
      </form>
      <NegativeStockWarning
        open={warningOpen}
        onClose={() => setWarningOpen(false)}
        onBypass={() => {
          setWarningOpen(false);
          commit().catch(() => undefined);
        }}
      />
    </>
  );
}
