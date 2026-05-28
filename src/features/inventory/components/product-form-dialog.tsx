"use client";

import { useRef, useState } from "react";
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
import type { ProductRecord } from "@/lib/offline/db";
import { useProductPriceInput } from "@/features/inventory/hooks/use-product-price-input";

type SubmitPayload = {
  id_produk?: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  harga_jual_unit_besar?: number;
  stok_saat_ini: number;
  stok_unit_besar_saat_ini: number;
  is_active: boolean;
  unit_small_name: string;
  unit_large_name?: string;
  unit_large_to_small?: number;
  allow_buy_in_small: boolean;
  allow_buy_in_large: boolean;
  allow_sell_in_small: boolean;
  allow_sell_in_large: boolean;
};

type Props = {
  open: boolean;
  editingProduct?: ProductRecord | null;
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
};

export function ProductFormDialog({ open, editingProduct, onClose, onSubmit }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [namaProduk, setNamaProduk] = useState(editingProduct?.nama_produk ?? "");
  const [sku, setSku] = useState(editingProduct?.sku ?? "");
  const [stokAwalUnitKecil, setStokAwalUnitKecil] = useState(
    String(editingProduct?.stok_saat_ini ?? 0),
  );
  const [stokAwalUnitBesar, setStokAwalUnitBesar] = useState(
    String(editingProduct?.stok_unit_besar_saat_ini ?? 0),
  );
  const [unitSmallName, setUnitSmallName] = useState(editingProduct?.unit_small_name ?? "pcs");
  const [unitLargeName, setUnitLargeName] = useState(editingProduct?.unit_large_name ?? "");
  const [unitLargeFactor, setUnitLargeFactor] = useState(
    editingProduct?.unit_large_to_small ? String(editingProduct.unit_large_to_small) : "",
  );
  const [allowBuyInSmall, setAllowBuyInSmall] = useState(editingProduct?.allow_buy_in_small ?? true);
  const [allowBuyInLarge, setAllowBuyInLarge] = useState(editingProduct?.allow_buy_in_large ?? false);
  const [allowSellInSmall, setAllowSellInSmall] = useState(editingProduct?.allow_sell_in_small ?? true);
  const [allowSellInLarge, setAllowSellInLarge] = useState(editingProduct?.allow_sell_in_large ?? false);
  const [isActive, setIsActive] = useState(editingProduct?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const smallPriceInput = useProductPriceInput(editingProduct?.harga_jual ?? 0);
  const largePriceInput = useProductPriceInput(editingProduct?.harga_jual_unit_besar ?? 0);
  const { moveSelectedAction, selectedAction, setSelectedAction } = useDialogActionNavigation({
    actions: ["cancel", "save"] as const,
    defaultAction: "save",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const stokUnitKecil = Math.max(0, Math.trunc(Number(stokAwalUnitKecil) || 0));
    const stokUnitBesar = Math.max(0, Math.trunc(Number(stokAwalUnitBesar) || 0));
    const normalizedSmallUnit = unitSmallName.trim();
    const normalizedLargeUnit = unitLargeName.trim();
    const hasLargeUnit = normalizedLargeUnit.length > 0;
    const parsedLargeFactor = hasLargeUnit ? Math.trunc(Number(unitLargeFactor) || 0) : undefined;
    const finalAllowBuyInLarge = hasLargeUnit ? allowBuyInLarge : false;
    const finalAllowSellInLarge = hasLargeUnit ? allowSellInLarge : false;
    const finalAllowBuyInSmall = allowBuyInSmall || !finalAllowBuyInLarge;
    const finalAllowSellInSmall = allowSellInSmall || !finalAllowSellInLarge;

    if (!namaProduk.trim()) {
      setError("Data belum valid. Periksa field yang ditandai lalu coba lagi.");
      return;
    }
    if (!normalizedSmallUnit || normalizedSmallUnit.length > 24) {
      setError("Data belum valid. Periksa field yang ditandai lalu coba lagi.");
      return;
    }
    if (hasLargeUnit && normalizedLargeUnit.length > 24) {
      setError("Data belum valid. Periksa field yang ditandai lalu coba lagi.");
      return;
    }
    if (hasLargeUnit && (!Number.isInteger(parsedLargeFactor) || (parsedLargeFactor ?? 0) < 2)) {
      setError("Data belum valid. Periksa field yang ditandai lalu coba lagi.");
      return;
    }
    if (!finalAllowBuyInSmall && !finalAllowBuyInLarge) {
      setError("Data belum valid. Periksa field yang ditandai lalu coba lagi.");
      return;
    }
    if (!finalAllowSellInSmall && !finalAllowSellInLarge) {
      setError("Data belum valid. Periksa field yang ditandai lalu coba lagi.");
      return;
    }

    if (
      smallPriceInput.hasDecimalFraction ||
      smallPriceInput.numericValue < 100 ||
      smallPriceInput.numericValue > 999999999
    ) {
      setError("Data belum valid. Periksa field yang ditandai lalu coba lagi.");
      return;
    }
    if (finalAllowSellInLarge) {
      if (
        largePriceInput.hasDecimalFraction ||
        largePriceInput.numericValue < 100 ||
        largePriceInput.numericValue > 999999999
      ) {
        setError("Harga jual unit besar belum valid.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        id_produk: editingProduct?.id_produk,
        nama_produk: namaProduk,
        sku,
        harga_jual: smallPriceInput.numericValue,
        harga_jual_unit_besar: finalAllowSellInLarge ? largePriceInput.numericValue : undefined,
        stok_saat_ini: stokUnitKecil,
        stok_unit_besar_saat_ini: hasLargeUnit ? stokUnitBesar : 0,
        is_active: isActive,
        unit_small_name: normalizedSmallUnit,
        unit_large_name: normalizedLargeUnit || undefined,
        unit_large_to_small: hasLargeUnit ? parsedLargeFactor : undefined,
        allow_buy_in_small: finalAllowBuyInSmall,
        allow_buy_in_large: finalAllowBuyInLarge,
        allow_sell_in_small: finalAllowSellInSmall,
        allow_sell_in_large: finalAllowSellInLarge,
      });
      setNamaProduk("");
      setSku("");
      setStokAwalUnitKecil("0");
      setStokAwalUnitBesar("0");
      setUnitSmallName("pcs");
      setUnitLargeName("");
      setUnitLargeFactor("");
      setAllowBuyInSmall(true);
      setAllowBuyInLarge(false);
      setAllowSellInSmall(true);
      setAllowSellInLarge(false);
      setIsActive(true);
      smallPriceInput.reset();
      largePriceInput.reset();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Data belum valid. Periksa field yang ditandai lalu coba lagi.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
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
            if (selectedAction === "save") {
              formRef.current?.requestSubmit();
              return;
            }
            onClose();
          }
        }}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{editingProduct ? "Ubah Produk" : "Tambah Produk"}</DialogTitle>
          <DialogDescription>
            Isi data produk untuk disimpan ke katalog inventory.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="space-y-3 rounded-md border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Produk Satuan
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="nama-produk">
                  Nama produk
                </label>
                <Input
                  id="nama-produk"
                  onChange={(event) => setNamaProduk(event.target.value)}
                  required
                  value={namaProduk}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="sku-produk">
                  SKU (opsional)
                </label>
                <Input id="sku-produk" onChange={(event) => setSku(event.target.value)} value={sku} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="unit-small">
                  Unit kecil
                </label>
                <Input
                  id="unit-small"
                  maxLength={24}
                  onChange={(event) => setUnitSmallName(event.target.value)}
                  placeholder="pcs"
                  required
                  value={unitSmallName}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="harga-produk">
                  Harga jual unit kecil
                </label>
                <Input
                  id="harga-produk"
                  inputMode="numeric"
                  onBlur={smallPriceInput.onBlur}
                  onChange={(event) => smallPriceInput.onChange(event.target.value)}
                  placeholder="15000"
                  required
                  value={smallPriceInput.displayValue}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="stok-awal-kecil">
                  Stok awal unit kecil
                </label>
                <Input
                  id="stok-awal-kecil"
                  min={0}
                  onChange={(event) => setStokAwalUnitKecil(event.target.value)}
                  type="number"
                  value={stokAwalUnitKecil}
                />
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium">Penjualan unit kecil</p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    checked={allowSellInSmall}
                    onChange={(event) => setAllowSellInSmall(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Izinkan jual unit kecil</span>
                </label>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium">Pembelian unit kecil (Stock In)</p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    checked={allowBuyInSmall}
                    onChange={(event) => setAllowBuyInSmall(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Izinkan beli unit kecil</span>
                </label>
              </div>
            </section>

            <section className="space-y-3 rounded-md border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unit Besar
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="unit-large">
                  Nama unit besar
                </label>
                <Input
                  id="unit-large"
                  maxLength={24}
                  onChange={(event) => {
                    const nextUnitLargeName = event.target.value;
                    setUnitLargeName(nextUnitLargeName);
                    if (!nextUnitLargeName.trim()) {
                      setAllowBuyInLarge(false);
                      setAllowSellInLarge(false);
                    }
                  }}
                  placeholder="dus"
                  value={unitLargeName}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="unit-factor">
                  Konversi ke unit kecil
                </label>
                <Input
                  disabled={!unitLargeName.trim()}
                  id="unit-factor"
                  min={2}
                  onChange={(event) => setUnitLargeFactor(event.target.value)}
                  placeholder="12"
                  type="number"
                  value={unitLargeFactor}
                />
                <p className="text-[11px] text-muted-foreground">Contoh: 1 dus = 12 pcs.</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="harga-produk-besar">
                  Harga jual unit besar
                </label>
                <Input
                  disabled={!unitLargeName.trim()}
                  id="harga-produk-besar"
                  inputMode="numeric"
                  onBlur={largePriceInput.onBlur}
                  onChange={(event) => largePriceInput.onChange(event.target.value)}
                  placeholder="165000"
                  value={largePriceInput.displayValue}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="stok-awal-besar">
                  Stok awal unit besar
                </label>
                <Input
                  disabled={!unitLargeName.trim()}
                  id="stok-awal-besar"
                  min={0}
                  onChange={(event) => setStokAwalUnitBesar(event.target.value)}
                  type="number"
                  value={stokAwalUnitBesar}
                />
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium">Penjualan unit besar</p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    checked={allowSellInLarge}
                    disabled={!unitLargeName.trim()}
                    onChange={(event) => setAllowSellInLarge(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Izinkan jual unit besar</span>
                </label>
              </div>
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-medium">Pembelian unit besar (Stock In)</p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    checked={allowBuyInLarge}
                    disabled={!unitLargeName.trim()}
                    onChange={(event) => setAllowBuyInLarge(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Izinkan beli unit besar</span>
                </label>
              </div>
            </section>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Stok unit kecil dan unit besar dipisahkan agar penjualan kemasan utuh tidak tercampur dengan eceran.
          </p>

          {editingProduct ? (
            <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>Status produk</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {isActive ? "Aktif" : "Nonaktif"}
                </span>
                <input
                  aria-label="Produk aktif"
                  checked={isActive}
                  onChange={(event) => {
                    const nextActive = event.target.checked;
                    if (!nextActive) {
                      const confirmed = window.confirm(
                        "Nonaktifkan produk ini? Produk nonaktif tidak muncul di daftar produk aktif.",
                      );
                      if (!confirmed) return;
                    }
                    setIsActive(nextActive);
                  }}
                  type="checkbox"
                />
              </span>
            </label>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <DialogFooter className="px-0 pb-0 pt-2">
            <Button
              className={getDialogActionButtonClass({
                selected: selectedAction === "cancel",
                variant: "outline",
              })}
              onClick={onClose}
              onFocus={() => setSelectedAction("cancel")}
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
              onClick={() => formRef.current?.requestSubmit()}
              onFocus={() => setSelectedAction("save")}
              type="button"
            >
              {submitting ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
