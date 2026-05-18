"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InventoryMutationUnit, ProductRecord } from "@/lib/offline/db";
import { useStockMutation } from "@/features/inventory/hooks/use-stock-mutation";
import {
  allowsLargeUnit,
  allowsSmallUnit,
  getLargeUnitName,
  getSmallUnitName,
} from "@/lib/inventory/uom";

type Props = {
  products: ProductRecord[];
  onCommitted?: () => Promise<void> | void;
};

export function StockInTab({ products, onCommitted }: Props) {
  const { submitMutation, submitting, error } = useStockMutation();
  const [productId, setProductId] = useState(products[0]?.id_produk ?? "");
  const [query, setQuery] = useState(products[0]?.nama_produk ?? "");
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState<InventoryMutationUnit>("SMALL");
  const selectedProduct =
    products.find((product) => product.id_produk === productId) ?? products[0];
  const selectedProductId = selectedProduct?.id_produk ?? "";

  const unitOptions = useMemo(() => {
    if (!selectedProduct) return [];

    const options: Array<{ value: InventoryMutationUnit; label: string }> = [];
    if (allowsSmallUnit(selectedProduct, "purchase")) {
      options.push({ value: "SMALL", label: getSmallUnitName(selectedProduct) });
    }

    const largeUnitName = getLargeUnitName(selectedProduct);
    if (largeUnitName && allowsLargeUnit(selectedProduct, "purchase")) {
      options.push({
        value: "LARGE",
        label: largeUnitName,
      });
    }

    return options;
  }, [selectedProduct]);
  const selectedUnit = unitOptions.some((option) => option.value === unit)
    ? unit
    : (unitOptions[0]?.value ?? "");

  const filteredProducts = products.filter((product) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return (
      product.nama_produk.toLowerCase().includes(keyword) ||
      product.sku?.toLowerCase().includes(keyword)
    );
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProduct || !selectedProductId || !selectedUnit) return;
    try {
      const quantity = Math.max(1, Math.trunc(Number(qty) || 1));
      await submitMutation({
        jenis_mutasi: "STOCK_IN",
        id_transaksi: `stock-in-${Date.now()}`,
        id_produk: selectedProductId,
        unit_mutasi: selectedUnit as InventoryMutationUnit,
        delta_qty: quantity,
        logical_clock: Date.now(),
      });
      await onCommitted?.();
      setQty("1");
      if (unitOptions.length > 0) {
        setUnit(unitOptions[0].value);
      }
      toast.success("Stock In berhasil disimpan.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan stock in.";
      toast.error(message);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="stock-in-combobox">
          Produk
        </label>
        <div className="relative">
          <Input
            aria-expanded={open}
            id="stock-in-combobox"
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            placeholder="Cari nama atau SKU..."
            value={query}
          />
          {open ? (
            <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-background shadow-sm">
              {filteredProducts.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">Produk tidak ditemukan.</p>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    key={product.id_produk}
                    onClick={() => {
                      setProductId(product.id_produk);
                      setQuery(product.nama_produk);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    <span>{product.nama_produk}</span>
                    <span className="text-xs text-muted-foreground">{product.sku ?? "-"}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Dipilih: {selectedProduct?.nama_produk ?? "Belum ada produk"}
        </p>
        {unitOptions.length === 0 ? (
          <p className="text-xs text-destructive">
            Produk ini belum punya konfigurasi unit transaksi pembelian.
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="stock-in-qty">
          Qty masuk
        </label>
        <Input
          id="stock-in-qty"
          min={1}
          onChange={(event) => setQty(event.target.value)}
          type="number"
          value={qty}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium" htmlFor="stock-in-unit">
          Unit masuk
        </label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          disabled={unitOptions.length === 0}
          id="stock-in-unit"
          onChange={(event) => setUnit(event.target.value as InventoryMutationUnit)}
          value={selectedUnit}
        >
          {unitOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedProduct ? (
          <p className="text-xs text-muted-foreground">
            Stock In akan menambah stok pada unit yang dipilih tanpa konversi otomatis.
          </p>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button type="submit">{submitting ? "Menyimpan..." : "Simpan Stock In"}</Button>
    </form>
  );
}
