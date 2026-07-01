import ExcelJS from "exceljs";
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
        marketplace_product_id: "MP-TEH",
        marketplace_sku_id: "SKU-TEH",
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
        marketplace_product_id: "MP-SUSU",
        marketplace_sku_id: "SKU-SUSU",
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
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:marketplace-export");
  });

  it("renders inventory tabs without stock adjustment", () => {
    render(<InventoryTabs />);
    expect(screen.getByRole("tab", { name: "Produk" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Stock In" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Marketplace" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Stock Adjustment" })).not.toBeInTheDocument();
  });

  it("loads default marketplace export config and restores saved local config", async () => {
    window.localStorage.setItem(
      "inventory.marketplace-export-config",
      JSON.stringify({
        productIdColumn: "C",
        skuIdColumn: "F",
        stockColumn: "J",
        startRow: 6,
        percentage: 45,
      }),
    );

    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));

    expect(await screen.findByLabelText("Kolom ID Produk")).toHaveValue("C");
    expect(screen.getByLabelText("Kolom ID SKU")).toHaveValue("F");
    expect(screen.getByLabelText("Kolom Stok")).toHaveValue("J");
    expect(screen.getByLabelText("Start Row")).toHaveValue(6);
    expect(screen.getByLabelText("Persentase Stok")).toHaveValue(45);
  });

  it("blocks processing when no xlsx file is selected", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Proses & Download" }));

    expect(await screen.findByText("Pilih file .xlsx terlebih dahulu.")).toBeInTheDocument();
  });

  it("validates excel-style column labels and start row before processing", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));

    fireEvent.change(await screen.findByLabelText("Kolom ID Produk"), {
      target: { value: "1B" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Proses & Download" }));

    expect(await screen.findByText("Kolom harus memakai format huruf Excel.")).toBeInTheDocument();
  });

  it("shows summary and download fallback after a successful process", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");
    sheet.addRow(["header 1"]);
    sheet.addRow(["header 2"]);
    sheet.addRow(["header 3"]);
    sheet.addRow([null, "MP-TEH", null, null, "SKU-TEH", null, null, null, 99]);
    sheet.addRow([null, "NOT-FOUND", null, null, "SKU-404", null, null, null, 99]);
    const bytes = await workbook.xlsx.writeBuffer();
    const file = new File([bytes], "template.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("tab", { name: "Marketplace" }));
    fireEvent.change(await screen.findByLabelText("File template marketplace"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Proses & Download" }));

    expect(await screen.findByText("Jumlah row diperiksa: 2")).toBeInTheDocument();
    expect(screen.getByText("Jumlah row match: 1")).toBeInTheDocument();
    expect(screen.getByText("Jumlah row diisi 0: 1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download Ulang" })).toHaveAttribute(
      "href",
      "blob:marketplace-export",
    );
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

  it("keeps inventory product actions outside the scroll region for short viewports", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Produk" }));

    const dialog = await screen.findByRole("dialog");
    const scrollRegion = within(dialog).getByTestId("product-form-scroll-region");

    expect(dialog.className).toContain("translate-y-0");
    expect(dialog.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(within(scrollRegion).queryByRole("button", { name: "Simpan Produk" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Simpan Produk" })).toBeInTheDocument();
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

  it("submits separate marketplace identifiers for large unit when configured", async () => {
    render(<InventoryTabs />);
    fireEvent.click(screen.getByRole("button", { name: "Tambah Produk" }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nama produk"), {
      target: { value: "Kopi Dus Marketplace" },
    });
    fireEvent.change(within(dialog).getByLabelText("Harga jual unit kecil"), {
      target: { value: "15000" },
    });
    fireEvent.click(within(dialog).getByLabelText("Jual di marketplace"));
    fireEvent.change(within(dialog).getByLabelText("Nama produk marketplace"), {
      target: { value: "Kopi Dus Marketplace Official" },
    });
    fireEvent.change(within(dialog).getByLabelText("ID produk marketplace"), {
      target: { value: "MP-001" },
    });
    fireEvent.change(within(dialog).getByLabelText("ID SKU marketplace"), {
      target: { value: "SKU-MP-001" },
    });
    fireEvent.change(within(dialog).getByLabelText("Nama unit besar"), {
      target: { value: "dus" },
    });
    fireEvent.change(within(dialog).getByLabelText("Konversi ke unit kecil"), {
      target: { value: "12" },
    });
    fireEvent.click(within(dialog).getByLabelText("Izinkan jual unit besar"));
    fireEvent.change(within(dialog).getByLabelText("Harga jual unit besar"), {
      target: { value: "150000" },
    });
    fireEvent.change(within(dialog).getByLabelText("ID produk marketplace unit besar"), {
      target: { value: "MP-001-DUS" },
    });
    fireEvent.change(within(dialog).getByLabelText("ID SKU marketplace unit besar"), {
      target: { value: "SKU-MP-001-DUS" },
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "Simpan Produk" }));

    await waitFor(() => {
      expect(saveProduct).toHaveBeenCalledTimes(1);
    });
    expect(saveProduct.mock.calls[0][0]).toMatchObject({
      nama_produk: "Kopi Dus Marketplace",
      is_marketplace: true,
      marketplace_product_id: "MP-001",
      marketplace_sku_id: "SKU-MP-001",
      marketplace_large_product_id: "MP-001-DUS",
      marketplace_large_sku_id: "SKU-MP-001-DUS",
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

  it("shows an icon-only marketplace badge on the right side for marketplace products", () => {
    render(<InventoryTabs />);

    const tehCell = screen.getByText("Teh Tarik").closest("td");
    const susuCell = screen.getByText("Kopi Susu").closest("td");
    const tubrukCell = screen.getByText("Kopi Tubruk").closest("td");

    expect(within(tehCell!).queryByText("Marketplace")).not.toBeInTheDocument();
    expect(within(susuCell!).queryByText("Marketplace")).not.toBeInTheDocument();
    expect(within(tubrukCell!).queryByText("Marketplace")).not.toBeInTheDocument();
    expect(within(tehCell!).getByLabelText("Produk marketplace")).toBeInTheDocument();
    expect(within(susuCell!).getByLabelText("Produk marketplace")).toBeInTheDocument();
    expect(within(tubrukCell!).queryByLabelText("Produk marketplace")).not.toBeInTheDocument();
    expect((tehCell!.firstElementChild as HTMLElement).lastElementChild).toHaveAttribute(
      "aria-label",
      "Produk marketplace",
    );
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
