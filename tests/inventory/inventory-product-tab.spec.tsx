import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryTabs } from "@/features/inventory/components/inventory-tabs";

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
        nama_produk: "Kopi Tubruk",
        sku: "KOPI-001",
        harga_jual: 15000,
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

describe("inventory product tab contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveProduct.mockResolvedValue({});
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders inventory tabs without stock adjustment", () => {
    render(<InventoryTabs />);
    expect(screen.getByRole("tab", { name: "Produk" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Stock In" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Stock Adjustment" })).not.toBeInTheDocument();
  });

  it("opens tambah produk modal and closes via batal action", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Produk" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Tambah Produk" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Batal" }));
    await waitFor(() => {
      expect(screen.queryByText("Isi data produk untuk disimpan ke katalog inventory.")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "Produk" })).toHaveAttribute("aria-selected", "true");
  });

  it("supports aktif/nonaktif toggle when editing product", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = await screen.findByRole("dialog");
    const switchInput = within(dialog).getByLabelText("Produk aktif") as HTMLInputElement;
    expect(switchInput.checked).toBe(true);

    fireEvent.click(switchInput);
    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan Produk" }));

    await waitFor(() => {
      expect(saveProduct).toHaveBeenCalledTimes(1);
    });
    expect(saveProduct.mock.calls[0][0]).toMatchObject({
      id_produk: "p-1",
      is_active: false,
    });
  });
});
