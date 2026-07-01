"use client";

import { useRef, useState } from "react";
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
import type { ProductRecord } from "@/lib/offline/db";

type PackageItemPayload = {
  component_product_id: string;
  component_unit: "SMALL" | "LARGE";
  component_qty: number;
};

type ExistingPackageItem = NonNullable<ProductRecord["package_items"]>[number];

type SubmitPayload = {
  id_produk?: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  stok_saat_ini: number;
  is_active: boolean;
  product_kind: "PACKAGE";
  is_marketplace: boolean;
  marketplace_product_name?: string;
  marketplace_sku_id?: string;
  package_items: PackageItemPayload[];
};

type ComponentDraft = {
  component_product_id: string;
  component_unit: "SMALL" | "LARGE";
  component_qty: string;
};

type Props = {
  open: boolean;
  editingPackage?: ProductRecord | null;
  componentProducts: ProductRecord[];
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
};

function createComponentDraft(item?: ExistingPackageItem): ComponentDraft {
  return {
    component_product_id: item?.component_product_id ?? "",
    component_unit: item?.component_unit ?? "SMALL",
    component_qty: item ? String(item.component_qty) : "1",
  };
}

export function PackageFormDialog({
  open,
  editingPackage,
  componentProducts,
  onClose,
  onSubmit,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [namaPaket, setNamaPaket] = useState(editingPackage?.nama_produk ?? "");
  const [sku, setSku] = useState(editingPackage?.sku ?? "");
  const [isMarketplace, setIsMarketplace] = useState(editingPackage?.is_marketplace ?? false);
  const [marketplaceProductName, setMarketplaceProductName] = useState(
    editingPackage?.marketplace_product_name ?? "",
  );
  const [marketplaceSkuId, setMarketplaceSkuId] = useState(
    editingPackage?.marketplace_sku_id ?? "",
  );
  const [componentRows, setComponentRows] = useState<ComponentDraft[]>(
    editingPackage?.package_items?.length
      ? editingPackage.package_items.map((item) => createComponentDraft(item))
      : [createComponentDraft()],
  );
  const [isActive, setIsActive] = useState(editingPackage?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateComponentRow(
    index: number,
    field: keyof ComponentDraft,
    value: string,
  ) {
    setComponentRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const normalizedName = namaPaket.trim();
    const normalizedMarketplaceName = marketplaceProductName.trim();
    const normalizedMarketplaceSkuId = marketplaceSkuId.trim();

    if (!normalizedName) {
      setError("Nama paket wajib diisi.");
      return;
    }

    if (isMarketplace && (!normalizedMarketplaceName || !normalizedMarketplaceSkuId)) {
      setError("Lengkapi data marketplace untuk paket.");
      return;
    }

    const packageItems: PackageItemPayload[] = [];
    for (const row of componentRows) {
      const componentProductId = row.component_product_id.trim();
      const componentQty = Number(row.component_qty);

      if (!componentProductId) {
        setError("Pilih produk komponen untuk semua baris paket.");
        return;
      }
      if (row.component_unit !== "SMALL" && row.component_unit !== "LARGE") {
        setError("Unit komponen paket tidak valid.");
        return;
      }
      if (!Number.isFinite(componentQty) || componentQty <= 0) {
        setError("Qty komponen paket harus lebih dari 0.");
        return;
      }
      if (editingPackage?.id_produk && componentProductId === editingPackage.id_produk) {
        setError("Paket tidak boleh memakai dirinya sendiri sebagai komponen.");
        return;
      }

      packageItems.push({
        component_product_id: componentProductId,
        component_unit: row.component_unit,
        component_qty: componentQty,
      });
    }

    if (packageItems.length === 0) {
      setError("Tambahkan minimal satu komponen paket.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        id_produk: editingPackage?.id_produk,
        nama_produk: normalizedName,
        sku: sku.trim() || undefined,
        harga_jual: 0,
        stok_saat_ini: 0,
        is_active: isActive,
        product_kind: "PACKAGE",
        is_marketplace: isMarketplace,
        marketplace_product_name: isMarketplace ? normalizedMarketplaceName : undefined,
        marketplace_sku_id: isMarketplace ? normalizedMarketplaceSkuId : undefined,
        package_items: packageItems,
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menyimpan paket.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editingPackage ? "Ubah Paket" : "Tambah Paket"}</DialogTitle>
          <DialogDescription>
            Pilih produk komponen untuk membentuk paket dan biarkan stok serta harga mengikuti komponennya.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="package-name">
                Nama paket
              </label>
              <Input
                id="package-name"
                onChange={(event) => setNamaPaket(event.target.value)}
                value={namaPaket}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="package-sku">
                SKU internal
              </label>
              <Input
                id="package-sku"
                onChange={(event) => setSku(event.target.value)}
                value={sku}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <label className="flex items-center gap-2 text-sm font-medium" htmlFor="package-marketplace">
              <input
                aria-label="Jual di marketplace"
                checked={isMarketplace}
                id="package-marketplace"
                onChange={(event) => setIsMarketplace(event.target.checked)}
                type="checkbox"
              />
              <span>Jual di marketplace</span>
            </label>

            {isMarketplace ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="package-marketplace-name">
                    Nama produk marketplace
                  </label>
                  <Input
                    id="package-marketplace-name"
                    onChange={(event) => setMarketplaceProductName(event.target.value)}
                    value={marketplaceProductName}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="package-marketplace-sku">
                    ID SKU marketplace
                  </label>
                  <Input
                    id="package-marketplace-sku"
                    onChange={(event) => setMarketplaceSkuId(event.target.value)}
                    value={marketplaceSkuId}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Komponen Paket
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Pilih produk normal yang membentuk isi paket.
                </p>
              </div>
              <Button
                onClick={() =>
                  setComponentRows((current) => [...current, createComponentDraft()])
                }
                type="button"
                variant="outline"
              >
                Tambah Komponen
              </Button>
            </div>

            <div className="space-y-3">
              {componentRows.map((row, index) => {
                const rowNumber = index + 1;

                return (
                  <div
                    className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[minmax(0,2fr)_160px_160px_auto]"
                    key={`package-component-${rowNumber}`}
                  >
                    <div className="space-y-1">
                      <label
                        className="text-xs font-medium"
                        htmlFor={`package-component-product-${rowNumber}`}
                      >
                        Produk komponen {rowNumber}
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        id={`package-component-product-${rowNumber}`}
                        onChange={(event) =>
                          updateComponentRow(index, "component_product_id", event.target.value)
                        }
                        value={row.component_product_id}
                      >
                        <option value="">Pilih produk</option>
                        {componentProducts.map((product) => (
                          <option key={product.id_produk} value={product.id_produk}>
                            {product.nama_produk}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        className="text-xs font-medium"
                        htmlFor={`package-component-unit-${rowNumber}`}
                      >
                        Unit komponen {rowNumber}
                      </label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        id={`package-component-unit-${rowNumber}`}
                        onChange={(event) =>
                          updateComponentRow(index, "component_unit", event.target.value)
                        }
                        value={row.component_unit}
                      >
                        <option value="SMALL">SMALL</option>
                        <option value="LARGE">LARGE</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label
                        className="text-xs font-medium"
                        htmlFor={`package-component-qty-${rowNumber}`}
                      >
                        Qty komponen {rowNumber}
                      </label>
                      <Input
                        id={`package-component-qty-${rowNumber}`}
                        min={1}
                        onChange={(event) =>
                          updateComponentRow(index, "component_qty", event.target.value)
                        }
                        type="number"
                        value={row.component_qty}
                      />
                    </div>

                    <div className="flex items-end">
                      <Button
                        disabled={componentRows.length === 1}
                        onClick={() =>
                          setComponentRows((current) =>
                            current.filter((_, rowIndex) => rowIndex !== index),
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
          </div>

          {editingPackage ? (
            <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>Status paket</span>
              <input
                aria-label="Paket aktif"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                type="checkbox"
              />
            </label>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button onClick={onClose} type="button" variant="outline">
              Batal
            </Button>
            <Button onClick={() => formRef.current?.requestSubmit()} type="button">
              {submitting ? "Menyimpan..." : "Simpan Paket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
