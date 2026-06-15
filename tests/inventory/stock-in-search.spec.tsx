import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InventoryTabs } from "@/features/inventory/components/inventory-tabs";

const saveProduct = vi.fn();
const submitMutation = vi.fn();

vi.mock("@/lib/offline/inventory-sync", () => ({
  startInventorySyncLoop: () => vi.fn(),
}));

vi.mock("@/features/inventory/hooks/use-product-catalog", () => ({
  useProductCatalog: () => ({
    products: [
      {
        id_produk: "p-1",
        nama_produk: "Kopi Hitam",
        sku: "KOP-001",
        harga_jual: 10000,
        stok_saat_ini: 3,
        is_active: true,
        updatedAt: Date.now(),
      },
      {
        id_produk: "p-2",
        nama_produk: "Teh Tarik",
        sku: "TEH-002",
        harga_jual: 12000,
        stok_saat_ini: 4,
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

vi.mock("@/features/inventory/hooks/use-stock-mutation", () => ({
  useStockMutation: () => ({
    submitMutation,
    submitting: false,
    error: null,
  }),
}));

describe("stock in product search", () => {
  it("filters selectable products by keyword", () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "Stock In" }));

    fireEvent.change(screen.getByLabelText("Produk"), { target: { value: "teh" } });

    expect(screen.getByRole("button", { name: /Teh Tarik/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Kopi Hitam/ })).not.toBeInTheDocument();
  });
});
