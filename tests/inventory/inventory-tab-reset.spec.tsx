import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryTabs } from "@/features/inventory/components/inventory-tabs";

const submitMutation = vi.fn();
const saveProduct = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));
vi.mock("@/lib/offline/inventory-sync", () => ({
  startInventorySyncLoop: () => vi.fn(),
}));

vi.mock("@/features/inventory/hooks/use-product-catalog", () => ({
  useProductCatalog: () => ({
    products: [
      {
        id_produk: "p-1",
        nama_produk: "Beras Premium",
        sku: "BR-001",
        harga_jual: 72000,
        stok_saat_ini: 12,
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

describe("stock tab reset behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitMutation.mockResolvedValue({});
  });

  it("resets stock in form after submit and stays on Stock In tab", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "Stock In" }));

    const qtyInput = screen.getByLabelText("Qty masuk") as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan Stock In" }));

    await waitFor(() => {
      expect(submitMutation).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("tab", { name: "Stock In" })).toHaveAttribute("aria-selected", "true");
    expect(qtyInput.value).toBe("1");
  });
});
