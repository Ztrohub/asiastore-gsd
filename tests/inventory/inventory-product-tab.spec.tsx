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
        is_marketplace: false,
        updatedAt: Date.now(),
      },
      {
        id_produk: "p-2",
        nama_produk: "Teh Tarik",
        sku: "TEH-001",
        harga_jual: 12000,
        stok_saat_ini: 4,
        is_active: true,
        is_marketplace: true,
        updatedAt: Date.now(),
      },
      {
        id_produk: "p-3",
        nama_produk: "Kopi Susu",
        sku: "KOPI-002",
        harga_jual: 17000,
        stok_saat_ini: 3,
        is_active: true,
        is_marketplace: true,
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

  it("submits marketplace metadata when marketplace checkbox is enabled", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Produk" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nama produk"), {
      target: { value: "Kopi Marketplace" },
    });
    fireEvent.change(within(dialog).getByLabelText("Harga jual unit kecil"), {
      target: { value: "15000" },
    });
    fireEvent.click(within(dialog).getByLabelText("Jual di marketplace"));
    fireEvent.change(within(dialog).getByLabelText("Nama produk marketplace"), {
      target: { value: "Kopi Marketplace Official" },
    });
    fireEvent.change(within(dialog).getByLabelText("ID produk marketplace"), {
      target: { value: "MP-001" },
    });
    fireEvent.change(within(dialog).getByLabelText("ID SKU marketplace"), {
      target: { value: "SKU-MP-001" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan Produk" }));

    await waitFor(() => {
      expect(saveProduct).toHaveBeenCalledTimes(1);
    });
    expect(saveProduct.mock.calls[0][0]).toMatchObject({
      nama_produk: "Kopi Marketplace",
      is_marketplace: true,
      marketplace_product_name: "Kopi Marketplace Official",
      marketplace_product_id: "MP-001",
      marketplace_sku_id: "SKU-MP-001",
    });
  });

  it("supports aktif/nonaktif toggle when editing product", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

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

  it("uses fuzzy search ordering and highlights matched product-name segments", () => {
    render(<InventoryTabs />);

    fireEvent.change(screen.getAllByPlaceholderText("Cari nama atau SKU...")[0], {
      target: { value: "tbruk kopi" },
    });

    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Kopi Tubruk");
    const firstNameCell = within(rows[1]).getAllByRole("cell")[0];
    expect(firstNameCell.querySelector("strong")).not.toBeNull();
  });

  it("shows a marketplace badge only for marketplace products", () => {
    render(<InventoryTabs />);

    expect(screen.getAllByText("Marketplace")).toHaveLength(2);
    expect(screen.getByText("Teh Tarik").closest("td")).toHaveTextContent("Marketplace");
    expect(screen.getByText("Kopi Susu").closest("td")).toHaveTextContent("Marketplace");
    expect(screen.getByText("Kopi Tubruk").closest("td")).not.toHaveTextContent("Marketplace");
  });

  it("applies marketplace filter only after saving from the right drawer and shows active badge", async () => {
    render(<InventoryTabs />);

    fireEvent.click(screen.getByRole("button", { name: /filter/i }));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByRole("heading", { name: "Filter Produk" })).toBeInTheDocument();
    expect(screen.getByText("Kopi Tubruk")).toBeInTheDocument();
    expect(screen.getByText("Teh Tarik")).toBeInTheDocument();
    expect(screen.getByText("Kopi Susu")).toBeInTheDocument();

    fireEvent.change(within(drawer).getByLabelText("Tipe produk"), {
      target: { value: "marketplace" },
    });

    expect(screen.getByText("Kopi Tubruk")).toBeInTheDocument();
    expect(screen.getByText("Teh Tarik")).toBeInTheDocument();
    expect(screen.getByText("Kopi Susu")).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(screen.queryByText("Kopi Tubruk")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Teh Tarik")).toBeInTheDocument();
    expect(screen.getByText("Kopi Susu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /filter/i })).toHaveTextContent("1");
    expect(screen.queryByRole("dialog", { name: "Filter Produk" })).not.toBeInTheDocument();
  });
});
