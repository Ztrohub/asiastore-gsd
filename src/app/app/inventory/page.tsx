import { InventoryTabs } from "@/features/inventory/components/inventory-tabs";

export default function InventoryPage() {
  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Inventori</h1>
        <p className="text-sm text-muted-foreground">
          Tambah produk, atur harga/status, dan stock in.
        </p>
      </header>
      <InventoryTabs />
    </main>
  );
}
