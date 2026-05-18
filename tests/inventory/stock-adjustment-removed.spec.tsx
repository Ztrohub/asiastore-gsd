import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InventoryTabs } from "@/features/inventory/components/inventory-tabs";

const saveProduct = vi.fn();
vi.mock("@/lib/offline/inventory-sync", () => ({
  startInventorySyncLoop: () => vi.fn(),
}));

vi.mock("@/features/inventory/hooks/use-product-catalog", () => ({
  useProductCatalog: () => ({
    products: [
      {
        id_produk: "p-1",
        nama_produk: "Gula Pasir",
        sku: "GL-001",
        harga_jual: 18000,
        stok_saat_ini: 8,
        is_active: true,
        updatedAt: Date.now(),
      },
    ],
    loading: false,
    error: null,
    saveProduct,
    refreshLocal: vi.fn(),
    syncFromServer: vi.fn(),
  }),
}));

describe("inventory tabs without stock adjustment", () => {
  it("does not render stock adjustment tab", () => {
    render(<InventoryTabs />);
    expect(screen.queryByRole("tab", { name: "Stock Adjustment" })).not.toBeInTheDocument();
  });
});
