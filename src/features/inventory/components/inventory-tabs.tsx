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
import { ProductFormDialog } from "@/features/inventory/components/product-form-dialog";
import { ProductTable } from "@/features/inventory/components/product-table";
import { StockInTab } from "@/features/inventory/components/stock-in-tab";
import { MarketplaceStockTab } from "@/features/inventory/components/marketplace-stock-tab";

type TabKey = "produk" | "stock-in" | "marketplace";
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<InventoryProductFilters>(
    DEFAULT_INVENTORY_PRODUCT_FILTERS,
  );
  const [draftFilters, setDraftFilters] = useState<InventoryProductFilters>(
    DEFAULT_INVENTORY_PRODUCT_FILTERS,
  );

  const hasProducts = useMemo(() => products.length > 0, [products]);
  const activeFilterCount = useMemo(
    () => (appliedFilters.productType === "all" ? 0 : 1),
    [appliedFilters.productType],
  );
  const filteredProducts = useMemo(() => {
    if (appliedFilters.productType === "marketplace") {
      return products.filter((product) => product.is_marketplace);
    }
    return products;
  }, [appliedFilters.productType, products]);

  async function handleSaveProduct(payload: {
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
  }) {
    await saveProduct(payload);
    toast.success("Produk berhasil disimpan.");
    setEditingProduct(null);
    setDialogOpen(false);
    setActiveTab("produk");
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setDialogOpen(true);
  }

  function openEditDialog(product: ProductRecord) {
    setEditingProduct(product);
    setDialogOpen(true);
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
      </div>

      <div hidden={activeTab !== "stock-in"} role="tabpanel">
        {hasProducts ? (
          <StockInTab onCommitted={refreshLocal} products={products} />
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada produk untuk diproses.</p>
        )}
      </div>

      <div hidden={activeTab !== "marketplace"} role="tabpanel">
        <MarketplaceStockTab products={products} />
      </div>

      <ProductFormDialog
        key={`${dialogOpen ? "open" : "closed"}:${editingProduct?.id_produk ?? "new"}`}
        editingProduct={editingProduct}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSaveProduct}
        open={dialogOpen}
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
