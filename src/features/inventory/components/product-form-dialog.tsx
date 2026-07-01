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
import {
  assertValidSpecialPriceRules,
  sortSpecialPriceRules,
  type ProductSpecialPriceRecord,
} from "@/lib/pricing/special-price";
import { parseRawPrice, useProductPriceInput } from "@/features/inventory/hooks/use-product-price-input";

type SubmitPayload = {
  id_produk?: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  harga_jual_unit_besar?: number;
  stok_saat_ini: number;
  stok_unit_besar_saat_ini: number;
  is_active: boolean;
  is_marketplace: boolean;
  marketplace_product_name?: string;
  marketplace_product_id?: string;
  marketplace_sku_id?: string;
  marketplace_large_product_id?: string;
  marketplace_large_sku_id?: string;
  unit_small_name: string;
  unit_large_name?: string;
  unit_large_to_small?: number;
  allow_buy_in_small: boolean;
  allow_buy_in_large: boolean;
  allow_sell_in_small: boolean;
  allow_sell_in_large: boolean;
  special_prices: ProductSpecialPriceRecord[];
};

type SpecialPriceDraft = {
  unit_mutasi: "SMALL" | "LARGE";
  qty: string;
  harga: string;
};

type Props = {
  open: boolean;
  editingProduct?: ProductRecord | null;
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
};

function createSpecialPriceDraft(rule?: ProductSpecialPriceRecord): SpecialPriceDraft {
  return {
    unit_mutasi: rule?.unit_mutasi ?? "SMALL",
    qty: rule ? (rule.qty_tenths / 10).toFixed(1) : "",
    harga: rule ? String(rule.harga) : "",
  };
}

function parseQtyTenths(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  const scaled = parsed * 10;
  const rounded = Math.round(scaled);

  if (!Number.isFinite(parsed) || Math.abs(scaled - rounded) > Number.EPSILON) {
    throw new Error("Qty harga khusus harus kelipatan 0.1 antara 0.1 sampai 0.9.");
  }

  return rounded;
}

function normalizeSpecialPriceDrafts(
  drafts: SpecialPriceDraft[],
  flags: { allowSmall: boolean; allowLarge: boolean },
) {
  const normalizedRules = sortSpecialPriceRules(
    drafts.map((draft) => ({
      unit_mutasi: draft.unit_mutasi,
      qty_tenths: parseQtyTenths(draft.qty),
      harga: parseRawPrice(draft.harga),
    })),
  );

  for (const rule of normalizedRules) {
    if (rule.unit_mutasi === "SMALL" && !flags.allowSmall) {
      throw new Error("Harga khusus unit kecil hanya bisa dipakai jika penjualan unit kecil aktif.");
    }
    if (rule.unit_mutasi === "LARGE" && !flags.allowLarge) {
      throw new Error("Harga khusus unit besar hanya bisa dipakai jika penjualan unit besar aktif.");
    }
  }

  assertValidSpecialPriceRules(normalizedRules);
  return normalizedRules;
}

export function ProductFormDialog({ open, editingProduct, onClose, onSubmit }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [namaProduk, setNamaProduk] = useState(editingProduct?.nama_produk ?? "");
  const [sku, setSku] = useState(editingProduct?.sku ?? "");
  const [isMarketplace, setIsMarketplace] = useState(editingProduct?.is_marketplace ?? false);
  const [marketplaceProductName, setMarketplaceProductName] = useState(
    editingProduct?.marketplace_product_name ?? "",
  );
  const [marketplaceProductId, setMarketplaceProductId] = useState(
    editingProduct?.marketplace_product_id ?? "",
  );
  const [marketplaceSkuId, setMarketplaceSkuId] = useState(
    editingProduct?.marketplace_sku_id ?? "",
  );
  const [marketplaceLargeProductId, setMarketplaceLargeProductId] = useState(
    editingProduct?.marketplace_large_product_id ?? "",
  );
  const [marketplaceLargeSkuId, setMarketplaceLargeSkuId] = useState(
    editingProduct?.marketplace_large_sku_id ?? "",
  );
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
  const [specialPriceDrafts, setSpecialPriceDrafts] = useState<SpecialPriceDraft[]>(
    editingProduct?.special_prices?.map((rule) => createSpecialPriceDraft(rule)) ?? [],
  );
  const [isActive, setIsActive] = useState(editingProduct?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const smallPriceInput = useProductPriceInput(editingProduct?.harga_jual ?? 0);
  const largePriceInput = useProductPriceInput(editingProduct?.harga_jual_unit_besar ?? 0);
  const { moveSelectedAction, registerActionRef, selectedAction, setSelectedAction } =
    useDialogActionNavigation({
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
    const normalizedMarketplaceProductName = marketplaceProductName.trim();
    const normalizedMarketplaceProductId = marketplaceProductId.trim();
    const normalizedMarketplaceSkuId = marketplaceSkuId.trim();
    const normalizedMarketplaceLargeProductId = marketplaceLargeProductId.trim();
    const normalizedMarketplaceLargeSkuId = marketplaceLargeSkuId.trim();

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
      isMarketplace &&
      (!normalizedMarketplaceProductName ||
        !normalizedMarketplaceProductId ||
        !normalizedMarketplaceSkuId)
    ) {
      setError("Lengkapi data marketplace untuk produk yang dijual di marketplace.");
      return;
    }
    if (
      isMarketplace &&
      hasLargeUnit &&
      Boolean(normalizedMarketplaceLargeProductId || normalizedMarketplaceLargeSkuId) &&
      (!normalizedMarketplaceLargeProductId || !normalizedMarketplaceLargeSkuId)
    ) {
      setError("Lengkapi ID marketplace unit besar jika salah satunya diisi.");
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

    let specialPrices: ProductSpecialPriceRecord[];
    try {
      specialPrices = normalizeSpecialPriceDrafts(specialPriceDrafts, {
        allowSmall: finalAllowSellInSmall,
        allowLarge: finalAllowSellInLarge,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Data harga khusus belum valid. Periksa field yang ditandai lalu coba lagi.";
      setError(message);
      return;
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
        is_marketplace: isMarketplace,
        marketplace_product_name: isMarketplace ? normalizedMarketplaceProductName : undefined,
        marketplace_product_id: isMarketplace ? normalizedMarketplaceProductId : undefined,
        marketplace_sku_id: isMarketplace ? normalizedMarketplaceSkuId : undefined,
        marketplace_large_product_id:
          isMarketplace && hasLargeUnit ? normalizedMarketplaceLargeProductId || undefined : undefined,
        marketplace_large_sku_id:
          isMarketplace && hasLargeUnit ? normalizedMarketplaceLargeSkuId || undefined : undefined,
        unit_small_name: normalizedSmallUnit,
        unit_large_name: normalizedLargeUnit || undefined,
        unit_large_to_small: hasLargeUnit ? parsedLargeFactor : undefined,
        allow_buy_in_small: finalAllowBuyInSmall,
        allow_buy_in_large: finalAllowBuyInLarge,
        allow_sell_in_small: finalAllowSellInSmall,
        allow_sell_in_large: finalAllowSellInLarge,
        special_prices: specialPrices,
      });
      setNamaProduk("");
      setSku("");
      setIsMarketplace(false);
      setMarketplaceProductName("");
      setMarketplaceProductId("");
      setMarketplaceSkuId("");
      setMarketplaceLargeProductId("");
      setMarketplaceLargeSkuId("");
      setStokAwalUnitKecil("0");
      setStokAwalUnitBesar("0");
      setUnitSmallName("pcs");
      setUnitLargeName("");
      setUnitLargeFactor("");
      setAllowBuyInSmall(true);
      setAllowBuyInLarge(false);
      setAllowSellInSmall(true);
      setAllowSellInLarge(false);
      setSpecialPriceDrafts([]);
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
        className="top-4 flex max-h-[calc(100dvh-2rem)] -translate-y-0 flex-col overflow-hidden p-0 sm:max-w-5xl"
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
        <DialogHeader className="shrink-0 border-b px-4 py-4 sm:px-6">
          <DialogTitle>{editingProduct ? "Ubah Produk" : "Tambah Produk"}</DialogTitle>
          <DialogDescription>
            Isi data produk untuk disimpan ke katalog inventory.
          </DialogDescription>
        </DialogHeader>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit} ref={formRef}>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" data-testid="product-form-scroll-region">
            <div className="space-y-4">
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
                  <div className="space-y-3 rounded-md border border-border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium" htmlFor="is-marketplace">
                      <input
                        aria-label="Jual di marketplace"
                        checked={isMarketplace}
                        id="is-marketplace"
                        onChange={(event) => {
                          const nextValue = event.target.checked;
                          setIsMarketplace(nextValue);
                          if (!nextValue) {
                            setMarketplaceProductName("");
                            setMarketplaceProductId("");
                            setMarketplaceSkuId("");
                            setMarketplaceLargeProductId("");
                            setMarketplaceLargeSkuId("");
                          }
                        }}
                        type="checkbox"
                      />
                      <span>Jual di marketplace</span>
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Aktifkan jika produk ini dijual di marketplace dengan identitas yang berbeda dari SKU internal.
                    </p>
                    {isMarketplace ? (
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium" htmlFor="marketplace-product-name">
                            Nama produk marketplace
                          </label>
                          <Input
                            id="marketplace-product-name"
                            onChange={(event) => setMarketplaceProductName(event.target.value)}
                            value={marketplaceProductName}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium" htmlFor="marketplace-product-id">
                            ID produk marketplace
                          </label>
                          <Input
                            id="marketplace-product-id"
                            onChange={(event) => setMarketplaceProductId(event.target.value)}
                            value={marketplaceProductId}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium" htmlFor="marketplace-sku-id">
                            ID SKU marketplace
                          </label>
                          <Input
                            id="marketplace-sku-id"
                            onChange={(event) => setMarketplaceSkuId(event.target.value)}
                            value={marketplaceSkuId}
                          />
                        </div>
                        {unitLargeName.trim() ? (
                          <div className="space-y-3 rounded-md border border-border p-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              Marketplace unit besar
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Isi jika unit besar dijual sebagai SKU marketplace terpisah.
                            </p>
                            <div className="space-y-1">
                              <label
                                className="text-xs font-medium"
                                htmlFor="marketplace-large-product-id"
                              >
                                ID produk marketplace unit besar
                              </label>
                              <Input
                                id="marketplace-large-product-id"
                                onChange={(event) => setMarketplaceLargeProductId(event.target.value)}
                                value={marketplaceLargeProductId}
                              />
                            </div>
                            <div className="space-y-1">
                              <label
                                className="text-xs font-medium"
                                htmlFor="marketplace-large-sku-id"
                              >
                                ID SKU marketplace unit besar
                              </label>
                              <Input
                                id="marketplace-large-sku-id"
                                onChange={(event) => setMarketplaceLargeSkuId(event.target.value)}
                                value={marketplaceLargeSkuId}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
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

              <section className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Harga Khusus Per Qty
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Atur harga final untuk pecahan qty 0.1 sampai 0.9 per unit jual.
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      setSpecialPriceDrafts((current) => [...current, createSpecialPriceDraft()])
                    }
                    type="button"
                    variant="outline"
                  >
                    Tambah harga khusus
                  </Button>
                </div>

                {specialPriceDrafts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada harga khusus. Produk akan memakai harga dasar untuk semua pecahan qty.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {specialPriceDrafts.map((draft, index) => {
                      const rowNumber = index + 1;
                      const showLargeOption =
                        Boolean(unitLargeName.trim()) || draft.unit_mutasi === "LARGE";

                      return (
                        <div
                          className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[140px_120px_1fr_auto]"
                          key={`special-price-${rowNumber}`}
                        >
                          <div className="space-y-1">
                            <label
                              className="text-xs font-medium"
                              htmlFor={`special-price-unit-${rowNumber}`}
                            >
                              Unit harga khusus {rowNumber}
                            </label>
                            <select
                              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                              id={`special-price-unit-${rowNumber}`}
                              onChange={(event) =>
                                setSpecialPriceDrafts((current) => {
                                  const next = [...current];
                                  next[index] = {
                                    ...next[index],
                                    unit_mutasi: event.target.value as "SMALL" | "LARGE",
                                  };
                                  return next;
                                })
                              }
                              value={draft.unit_mutasi}
                            >
                              <option value="SMALL">{unitSmallName.trim() || "Unit kecil"}</option>
                              {showLargeOption ? (
                                <option value="LARGE">{unitLargeName.trim() || "Unit besar"}</option>
                              ) : null}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium" htmlFor={`special-price-qty-${rowNumber}`}>
                              Qty harga khusus {rowNumber}
                            </label>
                            <Input
                              id={`special-price-qty-${rowNumber}`}
                              inputMode="decimal"
                              onChange={(event) =>
                                setSpecialPriceDrafts((current) => {
                                  const next = [...current];
                                  next[index] = { ...next[index], qty: event.target.value };
                                  return next;
                                })
                              }
                              placeholder="0.5"
                              value={draft.qty}
                            />
                          </div>

                          <div className="space-y-1">
                            <label
                              className="text-xs font-medium"
                              htmlFor={`special-price-price-${rowNumber}`}
                            >
                              Harga khusus {rowNumber}
                            </label>
                            <Input
                              id={`special-price-price-${rowNumber}`}
                              inputMode="numeric"
                              onChange={(event) =>
                                setSpecialPriceDrafts((current) => {
                                  const next = [...current];
                                  next[index] = { ...next[index], harga: event.target.value };
                                  return next;
                                })
                              }
                              placeholder="6000"
                              value={draft.harga}
                            />
                          </div>

                          <div className="flex items-end">
                            <Button
                              onClick={() =>
                                setSpecialPriceDrafts((current) =>
                                  current.filter((_, itemIndex) => itemIndex !== index),
                                )
                              }
                              type="button"
                              variant="outline"
                            >
                              Hapus
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

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
            </div>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 px-4 pb-4 pt-3 sm:px-6">
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
              onClick={() => formRef.current?.requestSubmit()}
              onFocus={() => setSelectedAction("save")}
              ref={registerActionRef("save")}
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
