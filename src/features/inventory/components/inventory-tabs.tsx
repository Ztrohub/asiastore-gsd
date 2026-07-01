"use client";

import { useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ProductRecord } from "@/lib/offline/db";
import { useProductCatalog } from "@/features/inventory/hooks/use-product-catalog";
import { PackageFormDialog } from "@/features/inventory/components/package-form-dialog";
import { PackageTable } from "@/features/inventory/components/package-table";
import { ProductFormDialog } from "@/features/inventory/components/product-form-dialog";
import { ProductTable } from "@/features/inventory/components/product-table";
import { StockInTab } from "@/features/inventory/components/stock-in-tab";
import { MarketplaceStockTab } from "@/features/inventory/components/marketplace-stock-tab";

type TabKey = "produk" | "paket" | "stock-in" | "marketplace";
type ProductTypeFilter = "all" | "marketplace";

type InventoryProductFilters = {
  productType: ProductTypeFilter;
};

const DEFAULT_INVENTORY_PRODUCT_FILTERS: InventoryProductFilters = {
  productType: "all",
};

export function InventoryTabs() {
  const { products, loading, error, saveProduct, refreshLocal } = useProductCatalog();
  const [activeTab, setActiveTab] = useState<TabKey>("produk");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [editingPackage, setEditingPackage] = useState<ProductRecord | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<InventoryProductFilters>(
    DEFAULT_INVENTORY_PRODUCT_FILTERS,
  );
  const [draftFilters, setDraftFilters] = useState<InventoryProductFilters>(
    DEFAULT_INVENTORY_PRODUCT_FILTERS,
  );

  const productRows = useMemo(
    () => products.filter((product) => (product.product_kind ?? "NORMAL") === "NORMAL"),
    [products],
  );
  const packageRows = useMemo(
    () => products.filter((product) => (product.product_kind ?? "NORMAL") === "PACKAGE"),
    [products],
  );
  const hasProducts = useMemo(() => productRows.length > 0, [productRows]);
  const activeFilterCount = useMemo(
    () => (appliedFilters.productType === "all" ? 0 : 1),
    [appliedFilters.productType],
  );
  const filteredProducts = useMemo(() => {
    if (appliedFilters.productType === "marketplace") {
      return productRows.filter((product) => product.is_marketplace);
    }
    return productRows;
  }, [appliedFilters.productType, productRows]);

  async function handleSaveProduct(payload: Parameters<typeof saveProduct>[0]) {
    await saveProduct(payload);
    const isPackage = (payload.product_kind ?? "NORMAL") === "PACKAGE";
    toast.success(isPackage ? "Paket berhasil disimpan." : "Produk berhasil disimpan.");
    setEditingProduct(null);
    setEditingPackage(null);
    setDialogOpen(false);
    setPackageDialogOpen(false);
    setActiveTab(isPackage ? "paket" : "produk");
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setEditingPackage(null);
    setDialogOpen(true);
  }

  function openEditDialog(product: ProductRecord) {
    setEditingProduct(product);
    setEditingPackage(null);
    setDialogOpen(true);
  }

  function openCreatePackageDialog() {
    setEditingProduct(null);
    setEditingPackage(null);
    setPackageDialogOpen(true);
  }

  function openEditPackageDialog(pkg: ProductRecord) {
    setEditingProduct(null);
    setEditingPackage(pkg);
    setPackageDialogOpen(true);
  }

  function openFilterDrawer() {
    setDraftFilters(appliedFilters);
    setFilterOpen(true);
  }

  function handleFilterOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDraftFilters(appliedFilters);
    }
    setFilterOpen(nextOpen);
  }

  function applyDraftFilters() {
    setAppliedFilters(draftFilters);
    setFilterOpen(false);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        <Button
          aria-selected={activeTab === "produk"}
          onClick={() => setActiveTab("produk")}
          role="tab"
          variant={activeTab === "produk" ? "default" : "outline"}
        >
          Produk
        </Button>
        <Button
          aria-selected={activeTab === "paket"}
          onClick={() => setActiveTab("paket")}
          role="tab"
          variant={activeTab === "paket" ? "default" : "outline"}
        >
          Paket
        </Button>
        <Button
          aria-selected={activeTab === "stock-in"}
          onClick={() => setActiveTab("stock-in")}
          role="tab"
          variant={activeTab === "stock-in" ? "default" : "outline"}
        >
          Stock In
        </Button>
        <Button
          aria-selected={activeTab === "marketplace"}
          onClick={() => setActiveTab("marketplace")}
          role="tab"
          variant={activeTab === "marketplace" ? "default" : "outline"}
        >
          Marketplace
        </Button>
      </div>

      <div hidden={activeTab !== "produk"} role="tabpanel">
        {activeTab === "produk" ? (
          <>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <Button
                  aria-label="Filter"
                  className="shrink-0"
                  onClick={openFilterDrawer}
                  type="button"
                  variant="outline"
                >
                  <ListFilter />
                  <span>Filter</span>
                  {activeFilterCount > 0 ? <Badge variant="secondary">{activeFilterCount}</Badge> : null}
                </Button>
                <Input
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari nama atau SKU..."
                  value={query}
                />
              </div>
              <Button onClick={openCreateDialog}>Tambah Produk</Button>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Memuat produk...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!loading ? (
              <ProductTable
                emptyDescription={
                  appliedFilters.productType === "marketplace"
                    ? "Belum ada produk marketplace yang cocok dengan filter saat ini."
                    : undefined
                }
                emptyTitle={
                  appliedFilters.productType === "marketplace" ? "Belum ada produk marketplace" : undefined
                }
                onEdit={openEditDialog}
                products={filteredProducts}
                query={query}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <div hidden={activeTab !== "paket"} role="tabpanel">
        {activeTab === "paket" ? (
          <>
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama atau SKU..."
                value={query}
              />
              <Button onClick={openCreatePackageDialog}>Tambah Paket</Button>
            </div>
            {loading ? <p className="text-sm text-muted-foreground">Memuat paket...</p> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!loading ? (
              <PackageTable onEdit={openEditPackageDialog} packages={packageRows} query={query} />
            ) : null}
          </>
        ) : null}
      </div>

      <div hidden={activeTab !== "stock-in"} role="tabpanel">
        {activeTab === "stock-in" ? (
          hasProducts ? (
            <StockInTab onCommitted={refreshLocal} products={productRows} />
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada produk untuk diproses.</p>
          )
        ) : null}
      </div>

      <div hidden={activeTab !== "marketplace"} role="tabpanel">
        {activeTab === "marketplace" ? <MarketplaceStockTab products={products} /> : null}
      </div>

      <ProductFormDialog
        key={`product:${dialogOpen ? "open" : "closed"}:${editingProduct?.id_produk ?? "new"}`}
        editingProduct={editingProduct}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSaveProduct}
        open={dialogOpen}
      />
      <PackageFormDialog
        key={`package:${packageDialogOpen ? "open" : "closed"}:${editingPackage?.id_produk ?? "new"}`}
        componentProducts={productRows}
        editingPackage={editingPackage}
        onClose={() => setPackageDialogOpen(false)}
        onSubmit={handleSaveProduct}
        open={packageDialogOpen}
      />

      <Sheet onOpenChange={handleFilterOpenChange} open={filterOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Filter Produk</SheetTitle>
            <SheetDescription>
              Pilih filter inventory yang ingin diterapkan ke daftar produk.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-2 px-4">
            <label className="text-xs font-medium" htmlFor="inventory-filter-product-type">
              Tipe produk
            </label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              id="inventory-filter-product-type"
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  productType: event.target.value as ProductTypeFilter,
                }))
              }
              value={draftFilters.productType}
            >
              <option value="all">Semua</option>
              <option value="marketplace">Marketplace</option>
            </select>
          </div>

          <SheetFooter>
            <Button className="w-full" onClick={applyDraftFilters} type="button">
              Simpan
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
