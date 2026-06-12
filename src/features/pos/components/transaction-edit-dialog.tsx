"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatJakartaDateTime } from "@/features/format/datetime";
import { useProductCatalog } from "@/features/inventory/hooks/use-product-catalog";
import { formatCurrencyIdr } from "@/features/format/currency";
import { PosCartItemDialog } from "@/features/pos/components/pos-cart-item-dialog";
import { PosQtyDialog } from "@/features/pos/components/pos-qty-dialog";
import { PosRemoveDialog } from "@/features/pos/components/pos-remove-dialog";
import { computeCheckoutTotals, type PosPaymentMethod } from "@/features/pos/hooks/use-pos-checkout";
import type { PosCartLine, PosCartUnitOption } from "@/features/pos/hooks/use-pos-cart";
import { resolveLinePricing } from "@/features/pos/lib/special-pricing";
import { getSellUnitOptions } from "@/features/pos/lib/product-units";
import type { TransactionHistoryEditableInput } from "@/features/pos/lib/transaction-history-update";
import { normalizeQuantityInput } from "@/lib/inventory/quantity";
import type { InventoryMutationUnit, PosTransactionRecord, ProductRecord } from "@/lib/offline/db";
import type { PosLinePricingSnapshot } from "@/lib/pricing/special-price";
import { createProductSearch } from "@/lib/search/product-fuzzy-search";

type Props = {
  open: boolean;
  transaction: PosTransactionRecord | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (input: TransactionHistoryEditableInput) => Promise<void> | void;
  onDelete: (id_transaksi: string) => Promise<void> | void;
  onRestore: (id_transaksi: string) => Promise<void> | void;
};

type ConfirmAction = "save" | "delete" | "restore" | null;

type StoredTransactionLine = PosTransactionRecord["lines"][number] & {
  pricing_snapshot?: PosLinePricingSnapshot;
};

function getEffectiveUnitOptions(product: ProductRecord): PosCartUnitOption[] {
  const options = getSellUnitOptions(product);
  if (options.length > 0) {
    return options;
  }

  return [
    {
      unit_mutasi: "SMALL" as InventoryMutationUnit,
      unit_label: product.unit_small_name?.trim() || "pcs",
      unit_price: product.harga_jual,
    },
  ];
}

function createPricingSnapshot(params: {
  qty: number;
  unit_mutasi: InventoryMutationUnit;
  unit_price: number;
  rules: ProductRecord["special_prices"];
}) {
  return resolveLinePricing({
    qty: params.qty,
    unit_mutasi: params.unit_mutasi,
    baseUnitPrice: params.unit_price,
    rules: params.rules ?? [],
  });
}

function getStoredLinePricingSnapshot(line: PosTransactionRecord["lines"][number]) {
  const snapshot = (line as StoredTransactionLine).pricing_snapshot;
  if (snapshot) {
    return snapshot;
  }

  return createPricingSnapshot({
    qty: line.qty,
    unit_mutasi: line.unit_mutasi ?? "SMALL",
    unit_price: line.unit_price,
    rules: [],
  });
}

function toDraftLine(
  line: PosTransactionRecord["lines"][number],
): PosCartLine {
  const pricingSnapshot = getStoredLinePricingSnapshot(line);
  return {
    id_produk: line.id_produk,
    nama_produk: line.nama_produk,
    nama_produk_dasar: line.nama_produk,
    harga_jual: line.unit_price,
    qty: line.qty,
    line_discount: line.line_discount,
    unit_mutasi: line.unit_mutasi ?? "SMALL",
    unit_label: line.unit_label ?? "pcs",
    pricing_snapshot: pricingSnapshot,
  };
}

function toStoredLine(line: PosCartLine): StoredTransactionLine {
  const storedLine = {
    id_produk: line.id_produk,
    nama_produk: line.nama_produk,
    unit_price: line.harga_jual,
    qty: line.qty,
    unit_mutasi: line.unit_mutasi,
    unit_label: line.unit_label,
    line_discount: line.line_discount,
    line_total: Math.max(0, line.pricing_snapshot.automatic_subtotal - line.line_discount),
    pricing_snapshot: line.pricing_snapshot,
  };

  return storedLine;
}

export function TransactionEditDialog({
  open,
  transaction,
  saving = false,
  onClose,
  onSave,
  onDelete,
  onRestore,
}: Props) {
  const { products, loading: productsLoading } = useProductCatalog();
  const [lines, setLines] = useState<PosCartLine[]>([]);
  const [note, setNote] = useState("");
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [amountReceivedInput, setAmountReceivedInput] = useState("0");
  const [query, setQuery] = useState("");
  const [qtyOpen, setQtyOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<InventoryMutationUnit>("SMALL");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [removeLineIndex, setRemoveLineIndex] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const deferredQuery = useDeferredValue(query);
  const searchProducts = useMemo(() => createProductSearch(products), [products]);
  const searchResults = useMemo(() => searchProducts(deferredQuery).slice(0, 6), [deferredQuery, searchProducts]);
  const normalizedLines = useMemo(() => lines.map(toStoredLine), [lines]);
  const totals = useMemo(
    () =>
      computeCheckoutTotals(
        normalizedLines.map((line) => ({
          id_produk: line.id_produk,
          nama_produk: line.nama_produk,
          unit_price: line.unit_price,
          qty: line.qty,
          unit_mutasi: line.unit_mutasi,
          unit_label: line.unit_label,
          line_discount: line.line_discount,
          pricing_snapshot: line.pricing_snapshot,
        })),
        orderDiscount,
      ),
    [normalizedLines, orderDiscount],
  );
  const isDeleted = transaction?.is_deleted ?? false;

  useEffect(() => {
    if (!open || !transaction) {
      return;
    }

    setLines(transaction.lines.map(toDraftLine));
    setNote(transaction.note ?? "");
    setOrderDiscount(transaction.order_discount);
    setPaymentMethod(transaction.payment_method);
    setAmountReceivedInput(String(transaction.amount_received ?? transaction.total_amount));
    setQuery("");
    setQtyOpen(false);
    setSelectedProduct(null);
    setEditingIndex(null);
    setItemDialogOpen(false);
    setRemoveLineIndex(null);
    setConfirmAction(null);
  }, [open, transaction]);

  const amountReceived =
    paymentMethod === "cash"
      ? Math.max(0, Math.trunc(Number(amountReceivedInput || "0")))
      : undefined;
  const changeAmount =
    paymentMethod === "cash" ? Math.max(0, (amountReceived ?? totals.total) - totals.total) : 0;

  const submitSave = async () => {
    if (!transaction) return;
    await onSave({
      id_transaksi: transaction.id_transaksi,
      lines: normalizedLines,
      payment_method: paymentMethod,
      amount_received: amountReceived,
      order_discount: orderDiscount,
      note,
    });
    setConfirmAction(null);
  };

  return (
    <>
      <Dialog onOpenChange={(state) => !state && onClose()} open={open}>
        <DialogContent
          className="max-h-[calc(100dvh-1rem)] max-w-[min(96vw,80rem)] overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:max-w-[min(96vw,80rem)]"
          showCloseButton={false}
        >
          <div className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] flex-col sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)]">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <DialogHeader>
                <DialogTitle>Edit transaksi {transaction?.short_id ?? "-"}</DialogTitle>
                <DialogDescription>
                  {transaction ? `Dibuat ${formatJakartaDateTime(transaction.client_timestamp)}` : "Edit transaksi"}
                </DialogDescription>
              </DialogHeader>

            {isDeleted ? (
              <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Transaksi ini sedang dinonaktifkan. Aktifkan kembali untuk mengubah field transaksi.
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-3">
                <label className="space-y-1 text-sm">
                  <span>Tambah item transaksi</span>
                  <Input
                    disabled={isDeleted}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari produk..."
                    value={query}
                  />
                </label>
                <div className="mt-2 space-y-2">
                  {productsLoading ? <p className="text-sm text-muted-foreground">Memuat produk...</p> : null}
                  {!productsLoading && searchResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Produk tidak ditemukan.</p>
                  ) : null}
                  {searchResults.map((result) => (
                    <button
                      className="flex w-full flex-col items-start gap-1 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:flex-row sm:items-center sm:justify-between"
                      disabled={isDeleted}
                      key={result.product.id_produk}
                      onClick={() => {
                        const options = getEffectiveUnitOptions(result.product);
                        setSelectedProduct(result.product);
                        setSelectedUnit(options[0].unit_mutasi);
                        setQtyOpen(true);
                      }}
                      type="button"
                    >
                      <span>{result.product.nama_produk}</span>
                      <span>{formatCurrencyIdr(result.product.harga_jual)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Item transaksi</p>
                  <p className="text-xs text-muted-foreground">{lines.length} item</p>
                </div>
                <div className="space-y-2">
                  {lines.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada item.</p>
                  ) : null}
                  {lines.map((line, index) => (
                    <div className="rounded-md border border-border/70 bg-background px-3 py-2" key={`${line.id_produk}-${index}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-medium">{line.nama_produk}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.qty} x {formatCurrencyIdr(line.harga_jual)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Diskon item {formatCurrencyIdr(line.line_discount)}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium">
                            {formatCurrencyIdr(
                              Math.max(0, line.pricing_snapshot.automatic_subtotal - line.line_discount),
                            )}
                          </p>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                              disabled={isDeleted}
                              onClick={() => {
                                setEditingIndex(index);
                                setItemDialogOpen(true);
                              }}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              Edit item
                            </Button>
                            <Button
                              disabled={isDeleted}
                              onClick={() => setRemoveLineIndex(index)}
                              size="sm"
                              type="button"
                              variant="destructive"
                            >
                              Hapus item
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-border p-3">
                <p className="text-sm font-semibold">Pembayaran</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    disabled={isDeleted}
                    onClick={() => setPaymentMethod("cash")}
                    type="button"
                    variant={paymentMethod === "cash" ? "default" : "outline"}
                  >
                    Tunai
                  </Button>
                  <Button
                    disabled={isDeleted}
                    onClick={() => setPaymentMethod("bank_transfer")}
                    type="button"
                    variant={paymentMethod === "bank_transfer" ? "default" : "outline"}
                  >
                    Transfer
                  </Button>
                </div>
                {paymentMethod === "cash" ? (
                  <label className="mt-3 block space-y-1 text-sm">
                    <span>Jumlah dibayar</span>
                    <Input
                      disabled={isDeleted}
                      inputMode="numeric"
                      onChange={(event) => setAmountReceivedInput(event.target.value)}
                      value={amountReceivedInput}
                    />
                  </label>
                ) : null}
                <p className="mt-2 text-sm text-muted-foreground">
                  {paymentMethod === "cash"
                    ? `Kembalian: ${formatCurrencyIdr(changeAmount)}`
                    : `Nominal transfer: ${formatCurrencyIdr(totals.total)}`}
                </p>
              </div>

              <div className="rounded-lg border border-border p-3">
                <label className="block space-y-1 text-sm">
                  <span>Diskon transaksi</span>
                  <Input
                    disabled={isDeleted}
                    inputMode="numeric"
                    onChange={(event) => setOrderDiscount(Math.max(0, Math.trunc(Number(event.target.value || "0"))))}
                    value={String(orderDiscount)}
                  />
                </label>

                <label className="mt-3 block space-y-1 text-sm">
                  <span>Catatan transaksi</span>
                  <textarea
                    aria-label="Catatan transaksi"
                    className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isDeleted}
                    onChange={(event) => setNote(event.target.value)}
                    value={note}
                  />
                </label>

                <div className="mt-3 space-y-1 rounded-md border border-border/70 bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrencyIdr(totals.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Diskon item</span>
                    <span>- {formatCurrencyIdr(totals.itemDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Diskon transaksi</span>
                    <span>- {formatCurrencyIdr(totals.orderDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/80 pt-1 font-semibold">
                    <span>Total</span>
                    <span>{formatCurrencyIdr(totals.total)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="font-semibold">Audit</p>
                <p className="mt-2 text-muted-foreground">
                  Edit terakhir: {transaction?.editedAt ? formatJakartaDateTime(transaction.editedAt) : "-"}
                  {transaction?.editedByUsername ? ` oleh ${transaction.editedByUsername}` : ""}
                </p>
                <p className="text-muted-foreground">
                  Delete terakhir: {transaction?.deletedAt ? formatJakartaDateTime(transaction.deletedAt) : "-"}
                  {transaction?.deletedByUsername ? ` oleh ${transaction.deletedByUsername}` : ""}
                </p>
              </div>
              </div>
            </div>
            </div>
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-background/95 p-4 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] supports-backdrop-filter:backdrop-blur sm:p-5">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <Button className="w-full sm:w-auto" onClick={onClose} type="button" variant="outline">
                  Tutup
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  disabled={isDeleted || saving || lines.length === 0}
                  onClick={() => setConfirmAction("save")}
                  type="button"
                >
                  Simpan perubahan
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  disabled={saving}
                  onClick={() => setConfirmAction(isDeleted ? "restore" : "delete")}
                  type="button"
                  variant={isDeleted ? "outline" : "destructive"}
                >
                  {isDeleted ? "Aktifkan kembali" : "Delete transaksi"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PosQtyDialog
        defaultQty="1"
        defaultUnitMutasi={selectedUnit}
        onClose={() => setQtyOpen(false)}
        onConfirm={(payload) => {
          if (!selectedProduct) return;
          const options = getEffectiveUnitOptions(selectedProduct);
          const chosen = options.find((item) => item.unit_mutasi === payload.unit_mutasi) ?? options[0];
          const qty = normalizeQuantityInput(payload.qty);
          const pricingSnapshot = createPricingSnapshot({
            qty,
            unit_mutasi: chosen.unit_mutasi,
            unit_price: chosen.unit_price,
            rules: selectedProduct.special_prices,
          });
          const nextLine: PosCartLine = {
            id_produk: selectedProduct.id_produk,
            nama_produk: `${selectedProduct.nama_produk} (${chosen.unit_label})`,
            nama_produk_dasar: selectedProduct.nama_produk,
            harga_jual: chosen.unit_price,
            qty,
            line_discount: 0,
            unit_mutasi: chosen.unit_mutasi,
            unit_label: chosen.unit_label,
            pricing_snapshot: pricingSnapshot,
          };

          setLines((current) => {
            const existingIndex = current.findIndex(
              (line) =>
                line.id_produk === nextLine.id_produk && line.unit_mutasi === nextLine.unit_mutasi,
            );
            if (existingIndex === -1) {
              return [...current, nextLine];
            }

            const next = [...current];
            next[existingIndex] = nextLine;
            return next;
          });
          setQtyOpen(false);
        }}
        open={qtyOpen}
        productName={selectedProduct?.nama_produk}
        unitOptions={selectedProduct ? getEffectiveUnitOptions(selectedProduct) : []}
      />

      <PosCartItemDialog
        line={editingIndex === null ? undefined : lines[editingIndex]}
        onClose={() => setItemDialogOpen(false)}
        onConfirm={({ qty, finalSubtotal }) => {
          if (editingIndex === null) return;
          setLines((current) => {
            const line = current[editingIndex];
            if (!line) return current;
            const pricingSnapshot = createPricingSnapshot({
              qty,
              unit_mutasi: line.unit_mutasi,
              unit_price: line.pricing_snapshot.base_unit_price,
              rules: line.pricing_snapshot.rules,
            });
            const automaticSubtotal = pricingSnapshot.automatic_subtotal;
            const cappedSubtotal = Math.max(0, Math.min(finalSubtotal, automaticSubtotal));
            const next = [...current];
            next[editingIndex] = {
              ...line,
              qty,
              line_discount: Math.max(0, automaticSubtotal - cappedSubtotal),
              pricing_snapshot: pricingSnapshot,
            };
            return next;
          });
          setItemDialogOpen(false);
        }}
        onDelete={() => {
          if (editingIndex === null) return;
          setItemDialogOpen(false);
          setRemoveLineIndex(editingIndex);
        }}
        open={itemDialogOpen}
      />

      <PosRemoveDialog
        confirmLabel="Hapus item"
        onClose={() => setRemoveLineIndex(null)}
        onConfirm={() => {
          if (removeLineIndex === null) return;
          setLines((current) => current.filter((_, index) => index !== removeLineIndex));
          setRemoveLineIndex(null);
        }}
        open={removeLineIndex !== null}
        title="Hapus item transaksi?"
        description="Item ini akan dihapus dari draft transaksi."
      />

      <PosRemoveDialog
        confirmLabel="Simpan"
        confirmVariant="default"
        description="Perubahan transaksi akan disimpan dan disinkronkan saat online."
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          Promise.resolve(submitSave()).catch(() => undefined);
        }}
        open={confirmAction === "save"}
        title="Simpan perubahan transaksi?"
      />

      <PosRemoveDialog
        confirmLabel="Delete transaksi"
        description="Transaksi tidak dihapus dari database, tetapi akan diberi flag terhapus."
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!transaction) return;
          Promise.resolve(onDelete(transaction.id_transaksi)).catch(() => undefined);
          setConfirmAction(null);
        }}
        open={confirmAction === "delete"}
        title="Delete transaksi?"
      />

      <PosRemoveDialog
        confirmLabel="Aktifkan kembali"
        confirmVariant="default"
        description="Transaksi akan diaktifkan kembali dan bisa diedit."
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!transaction) return;
          Promise.resolve(onRestore(transaction.id_transaksi)).catch(() => undefined);
          setConfirmAction(null);
        }}
        open={confirmAction === "restore"}
        title="Aktifkan kembali transaksi?"
      />
    </>
  );
}
