"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductRecord } from "@/lib/offline/db";
import { useProductCatalog } from "@/features/inventory/hooks/use-product-catalog";
import { ProductFormDialog } from "@/features/inventory/components/product-form-dialog";
import { ProductTable } from "@/features/inventory/components/product-table";
import { StockInTab } from "@/features/inventory/components/stock-in-tab";

type TabKey = "produk" | "stock-in";

export function InventoryTabs() {
  const { products, loading, error, saveProduct, refreshLocal } = useProductCatalog();
  const [activeTab, setActiveTab] = useState<TabKey>("produk");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);

  const hasProducts = useMemo(() => products.length > 0, [products]);

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
      </div>

      <div hidden={activeTab !== "produk"} role="tabpanel">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama atau SKU..."
            value={query}
          />
          <Button onClick={openCreateDialog}>Tambah Produk</Button>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Memuat produk...</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading ? <ProductTable onEdit={openEditDialog} products={products} query={query} /> : null}
      </div>

      <div hidden={activeTab !== "stock-in"} role="tabpanel">
        {hasProducts ? (
          <StockInTab onCommitted={refreshLocal} products={products} />
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada produk untuk diproses.</p>
        )}
      </div>

      <ProductFormDialog
        key={`${dialogOpen ? "open" : "closed"}:${editingProduct?.id_produk ?? "new"}`}
        editingProduct={editingProduct}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSaveProduct}
        open={dialogOpen}
      />
    </section>
  );
}
