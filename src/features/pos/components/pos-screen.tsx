"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { PosCartItemDialog } from "@/features/pos/components/pos-cart-item-dialog";
import { PosCartPanel } from "@/features/pos/components/pos-cart-panel";
import { PosPaymentDialog } from "@/features/pos/components/pos-payment-dialog";
import { PosProductTable } from "@/features/pos/components/pos-product-table";
import { PosQtyDialog } from "@/features/pos/components/pos-qty-dialog";
import { PosReceiptPrompt } from "@/features/pos/components/pos-receipt-prompt";
import { PosRemoveDialog } from "@/features/pos/components/pos-remove-dialog";
import { useProductCatalog } from "@/features/inventory/hooks/use-product-catalog";
import { usePosCart } from "@/features/pos/hooks/use-pos-cart";
import { usePosCheckout, type PosPaymentMethod, computeCheckoutTotals } from "@/features/pos/hooks/use-pos-checkout";
import { usePrinterBridgeSettings } from "@/features/pos/hooks/use-printer-bridge-settings";
import { useReceiptPrinting } from "@/features/pos/hooks/use-receipt-printing";
import { getSellUnitOptions } from "@/features/pos/lib/product-units";
import { normalizeQuantityInput } from "@/lib/inventory/quantity";
import type { InventoryMutationUnit, ProductRecord } from "@/lib/offline/db";
import { createProductSearch } from "@/lib/search/product-fuzzy-search";

type FocusMode = "products" | "cart";

type PosKeyboardEvent = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
};

function isEditableElement(target: HTMLElement | null) {
  if (!target) return false;
  const tag = target.tagName.toLowerCase();
  if (target.isContentEditable) return true;
  return tag === "input" || tag === "textarea" || tag === "select";
}

function getEffectiveUnitOptions(product: ProductRecord) {
  const options = getSellUnitOptions(product);
  if (options.length > 0) return options;
  return [
    {
      unit_mutasi: "SMALL" as InventoryMutationUnit,
      unit_label: product.unit_small_name?.trim() || "pcs",
      unit_price: product.harga_jual,
    },
  ];
}

export function PosScreen() {
  const { products, loading } = useProductCatalog();
  const {
    lines,
    cartIndex,
    setCartIndex,
    note,
    setNote,
    upsertLine,
    updateLineBySubtotal,
    removeAt,
    clearCart,
  } = usePosCart();
  const { settings: printerSettings } = usePrinterBridgeSettings();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [productIndex, setProductIndex] = useState(0);
  const [focusMode, setFocusMode] = useState<FocusMode>("products");
  const [qtyOpen, setQtyOpen] = useState(false);
  const [qtyDialogKey, setQtyDialogKey] = useState(0);
  const [qtyDefaultUnit, setQtyDefaultUnit] = useState<InventoryMutationUnit>("SMALL");
  const [cartItemOpen, setCartItemOpen] = useState(false);
  const [cartItemDialogKey, setCartItemDialogKey] = useState(0);
  const [editingCartIndex, setEditingCartIndex] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDialogKey, setDeleteDialogKey] = useState(0);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidDialogKey, setVoidDialogKey] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentDialogKey, setPaymentDialogKey] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("cash");
  const [orderDiscountInput, setOrderDiscountInput] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const { submitCheckout, error: checkoutError } = usePosCheckout();
  const {
    pendingTransaction,
    promptReceipt,
    closePrompt,
    printOnceAndClose,
    printError,
    printing,
    printStatusMessage,
    printStatusType,
    clearPrintStatus,
  } = useReceiptPrinting();

  const searchProducts = useMemo(() => createProductSearch(products), [products]);
  const filteredProductResults = useMemo(
    () => searchProducts(deferredQuery),
    [deferredQuery, searchProducts],
  );
  const filteredProducts = useMemo(
    () => filteredProductResults.map((result) => result.product),
    [filteredProductResults],
  );

  const checkoutLines = useMemo(
    () =>
      lines.map((line) => ({
        id_produk: line.id_produk,
        nama_produk: line.nama_produk,
        unit_price: line.harga_jual,
        qty: line.qty,
        unit_mutasi: line.unit_mutasi,
        unit_label: line.unit_label,
        line_discount: line.line_discount,
      })),
    [lines],
  );
  const totals = useMemo(
    () => computeCheckoutTotals(checkoutLines, Math.max(0, Math.trunc(orderDiscountInput))),
    [checkoutLines, orderDiscountInput],
  );
  const safeProductIndex = Math.min(productIndex, Math.max(filteredProducts.length - 1, 0));
  const safeCartIndex = Math.min(cartIndex, Math.max(lines.length - 1, 0));
  const activeProduct = filteredProducts[safeProductIndex];
  const activeCartLine = lines[safeCartIndex];
  const hasBlockingDialog =
    qtyOpen || cartItemOpen || deleteOpen || voidOpen || paymentOpen || Boolean(pendingTransaction);

  const resetTransactionDraft = useCallback(() => {
    clearCart();
    setOrderDiscountInput(0);
    setQuery("");
    setProductIndex(0);
    setFocusMode("products");
    searchRef.current?.focus();
  }, [clearCart]);

  const openQtyForProduct = useCallback(
    (index: number) => {
      const product = filteredProducts[index];
      if (!product) return;
      const options = getEffectiveUnitOptions(product);
      setProductIndex(index);
      setQtyDefaultUnit(options[0].unit_mutasi);
      setQtyDialogKey((prev) => prev + 1);
      setQtyOpen(true);
    },
    [filteredProducts],
  );

  const openCartItemDialog = useCallback(
    (index: number) => {
      if (!lines[index]) return;
      setEditingCartIndex(index);
      setCartItemDialogKey((prev) => prev + 1);
      setCartItemOpen(true);
    },
    [lines],
  );

  const openPayment = useCallback(
    (method: PosPaymentMethod) => {
      if (lines.length === 0) return;
      clearPrintStatus();
      setPaymentMethod(method);
      setPaymentDialogKey((prev) => prev + 1);
      setPaymentOpen(true);
    },
    [clearPrintStatus, lines.length],
  );

  const requestVoidTransaction = useCallback(() => {
    if (lines.length === 0) return;
    clearPrintStatus();
    setVoidDialogKey((prev) => prev + 1);
    setVoidOpen(true);
  }, [clearPrintStatus, lines.length]);

  const handlePosKeydown = useCallback(
    (event: PosKeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const isSearchTarget = target === searchRef.current;
      const isEditable = isEditableElement(target);

      if (!hasBlockingDialog && event.key === "F8" && lines.length > 0) {
        event.preventDefault();
        openPayment("cash");
        return;
      }
      if (!hasBlockingDialog && event.key === "F9" && lines.length > 0) {
        event.preventDefault();
        openPayment("bank_transfer");
        return;
      }
      if (!hasBlockingDialog && event.key === "F10" && lines.length > 0) {
        event.preventDefault();
        requestVoidTransaction();
        return;
      }

      if (hasBlockingDialog) return;

      if (isEditable && !isSearchTarget) return;

      const isPrintable =
        event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;

      if (isPrintable && !isSearchTarget) {
        event.preventDefault();
        setFocusMode("products");
        setQuery((prev) => `${prev}${event.key}`);
        setProductIndex(0);
        searchRef.current?.focus();
        return;
      }

      if (event.key === "Backspace" && !isSearchTarget) {
        event.preventDefault();
        setFocusMode("products");
        setQuery((prev) => prev.slice(0, -1));
        setProductIndex(0);
        searchRef.current?.focus();
        return;
      }

      if (event.key === "ArrowDown" && focusMode === "products") {
        event.preventDefault();
        setProductIndex((prev) => Math.min(prev + 1, Math.max(filteredProducts.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp" && focusMode === "products") {
        event.preventDefault();
        setProductIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "ArrowDown" && focusMode === "cart") {
        event.preventDefault();
        setCartIndex((prev) => Math.min(prev + 1, Math.max(lines.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp" && focusMode === "cart") {
        event.preventDefault();
        setCartIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setFocusMode("cart");
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setFocusMode("products");
        searchRef.current?.focus();
        return;
      }
      if (event.key === "Enter" && focusMode === "products") {
        event.preventDefault();
        if (!activeProduct) return;
        openQtyForProduct(safeProductIndex);
        return;
      }
      if (event.key === "Enter" && focusMode === "cart") {
        event.preventDefault();
        if (!activeCartLine) return;
        openCartItemDialog(safeCartIndex);
        return;
      }
      if (event.key === "Delete" && focusMode === "cart" && activeCartLine) {
        event.preventDefault();
        setDeleteDialogKey((prev) => prev + 1);
        setDeleteOpen(true);
      }
    },
    [
      activeCartLine,
      activeProduct,
      filteredProducts.length,
      focusMode,
      hasBlockingDialog,
      lines.length,
      openCartItemDialog,
      openPayment,
      openQtyForProduct,
      requestVoidTransaction,
      safeProductIndex,
      safeCartIndex,
      setCartIndex,
    ],
  );

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handlePosKeydown(event);
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [handlePosKeydown]);

  return (
    <section className="space-y-3 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col">
      {printStatusMessage ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            printStatusType === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {printStatusMessage}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card p-3 xl:flex-none">
        <Input
          aria-label="Global Search"
          autoFocus
          onChange={(event) => {
            setQuery(event.target.value);
            setProductIndex(0);
            setFocusMode("products");
          }}
          onFocus={() => setFocusMode("products")}
          placeholder="Cari produk..."
          ref={searchRef}
          value={query}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Ketik langsung untuk cari produk | Arrow atas/bawah navigasi | Enter pilih/edit |
          Arrow kanan ke keranjang | Delete hapus item | F8 tunai | F9 transfer | F10 void
        </p>
        <Link className="mt-2 inline-block text-xs text-primary underline underline-offset-2" href="/app/settings/printer">
          Ubah pengaturan QZ Tray
        </Link>
      </div>

      <div className="grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,3fr)_minmax(420px,2fr)]">
        <div className="space-y-2 xl:flex xl:min-h-0 xl:flex-col">
          {loading ? <p className="text-sm text-muted-foreground">Memuat produk...</p> : null}
          <PosProductTable
            activeIndex={safeProductIndex}
            focusMode={focusMode}
            onSelect={(idx) => {
              setProductIndex(idx);
              setFocusMode("products");
            }}
            onSubmit={(product) => {
              const idx = filteredProducts.findIndex((row) => row.id_produk === product.id_produk);
              if (idx >= 0) openQtyForProduct(idx);
            }}
            results={filteredProductResults}
          />
        </div>
        <div className="space-y-2 xl:flex xl:min-h-0 xl:flex-col">
          <PosCartPanel
            activeIndex={safeCartIndex}
            focusMode={focusMode}
            itemDiscountTotal={totals.itemDiscount}
            lines={lines}
            onCashCheckout={() => openPayment("cash")}
            onOrderDiscountChange={(value) => setOrderDiscountInput(Math.max(0, Math.trunc(value)))}
            onSelect={(idx) => {
              setCartIndex(idx);
              setFocusMode("cart");
            }}
            onTransferCheckout={() => openPayment("bank_transfer")}
            onVoidTransaction={requestVoidTransaction}
            orderDiscount={totals.orderDiscount}
            subtotal={totals.subtotal}
            total={totals.total}
          />
          <label className="space-y-1 text-sm">
            <span>Catatan transaksi (opsional)</span>
            <textarea
              className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring xl:h-20 xl:flex-none"
              data-testid="transaction-note"
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </label>
        </div>
      </div>

      <PosQtyDialog
        key={`qty-${qtyDialogKey}`}
        defaultQty="1"
        defaultUnitMutasi={qtyDefaultUnit}
        onClose={() => setQtyOpen(false)}
        onConfirm={(payload) => {
          try {
            const qty = normalizeQuantityInput(payload.qty);
            if (!activeProduct) return;
            const options = getEffectiveUnitOptions(activeProduct);
            const selected = options.find((item) => item.unit_mutasi === payload.unit_mutasi) ?? options[0];
            upsertLine(activeProduct, qty, selected);
            setQtyOpen(false);
            setFocusMode("products");
            searchRef.current?.focus();
          } catch {
            // keep dialog open for correction
          }
        }}
        open={qtyOpen}
        productName={activeProduct?.nama_produk}
        unitOptions={activeProduct ? getEffectiveUnitOptions(activeProduct) : []}
      />

      <PosCartItemDialog
        key={`cart-item-${cartItemDialogKey}`}
        line={editingCartIndex === null ? undefined : lines[editingCartIndex]}
        onClose={() => setCartItemOpen(false)}
        onDelete={() => {
          setCartItemOpen(false);
          setDeleteDialogKey((prev) => prev + 1);
          setDeleteOpen(true);
        }}
        onConfirm={({ qty, finalSubtotal }) => {
          if (editingCartIndex === null) return;
          updateLineBySubtotal(editingCartIndex, qty, finalSubtotal);
          setCartItemOpen(false);
          searchRef.current?.focus();
        }}
        open={cartItemOpen}
      />

      <PosRemoveDialog
        key={`delete-${deleteDialogKey}`}
        itemName={activeCartLine?.nama_produk}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => {
          removeAt(safeCartIndex);
          setDeleteOpen(false);
          searchRef.current?.focus();
        }}
        open={deleteOpen}
      />

      <PosRemoveDialog
        confirmLabel="Void transaksi"
        description="Semua item, diskon, dan catatan transaksi akan dihapus."
        key={`void-${voidDialogKey}`}
        onClose={() => setVoidOpen(false)}
        onConfirm={() => {
          setVoidOpen(false);
          resetTransactionDraft();
        }}
        open={voidOpen}
        title="Void transaksi?"
      />

      <PosPaymentDialog
        key={`payment-${paymentDialogKey}`}
        lines={checkoutLines}
        onClose={() => setPaymentOpen(false)}
        onSubmit={async ({ amountReceived }) => {
          const saved = await submitCheckout({
            lines: checkoutLines,
            payment_method: paymentMethod,
            amount_received: amountReceived,
            order_discount: totals.orderDiscount,
            note,
          });
          setPaymentOpen(false);
          resetTransactionDraft();
          promptReceipt(saved);
        }}
        open={paymentOpen}
        orderDiscount={totals.orderDiscount}
        paymentMethod={paymentMethod}
      />

      <PosReceiptPrompt
        key={pendingTransaction?.id_transaksi ?? "receipt-prompt"}
        onPrint={async () => {
          await printOnceAndClose(printerSettings);
          searchRef.current?.focus();
        }}
        onSkip={() => {
          closePrompt();
          searchRef.current?.focus();
        }}
        open={Boolean(pendingTransaction)}
        printError={printError ?? checkoutError}
        printing={printing}
        transaction={pendingTransaction}
      />
    </section>
  );
}
