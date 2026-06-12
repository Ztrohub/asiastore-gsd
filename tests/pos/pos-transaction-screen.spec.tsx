import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosTransactionsScreen } from "@/features/pos/components/pos-transactions-screen";

const setDateFrom = vi.fn();
const setDateTo = vi.fn();
const goToPreviousPage = vi.fn();
const goToNextPage = vi.fn();
const reload = vi.fn();
const updateTransaction = vi.fn();
const softDeleteTransaction = vi.fn();
const restoreTransaction = vi.fn();

const activeTransaction = {
  id_transaksi: "tx-remote-1",
  short_id: "TRX-001",
  kasir_user_id: "user-1",
  kasir_username: "kasir",
  payment_method: "cash" as const,
  subtotal_amount: 25000,
  item_discount: 1000,
  order_discount: 0,
  total_amount: 24000,
  amount_received: 25000,
  change_amount: 1000,
  counts_for_cash: true,
  note: "dibayar tunai",
  is_deleted: false,
  editedAt: undefined,
  editedByUserId: undefined,
  editedByUsername: undefined,
  deletedAt: undefined,
  deletedByUserId: undefined,
  deletedByUsername: undefined,
  client_timestamp: Date.parse("2026-06-01T02:00:00.000Z"),
  createdAt: Date.parse("2026-06-01T02:05:00.000Z"),
  lines: [
    {
      id_produk: "prod-1",
      nama_produk: "Kopi Susu Spesial",
      unit_price: 10000,
      qty: 1.6,
      unit_mutasi: "SMALL",
      unit_label: "pcs",
      line_discount: 1000,
      line_total: 16000,
      pricing_snapshot: {
        base_unit_price: 10000,
        automatic_subtotal: 17000,
        rules: [{ unit_mutasi: "SMALL" as const, qty_tenths: 5, harga: 6000 }],
        breakdown: [
          { qty: 1.1, unit_price: 10000, total: 11000, source: "base" as const },
          { qty: 0.5, unit_price: 6000, total: 6000, source: "special" as const },
        ],
      },
    },
    {
      id_produk: "prod-2",
      nama_produk: "Roti Bakar",
      unit_price: 8000,
      qty: 1,
      unit_mutasi: "SMALL",
      unit_label: "pcs",
      line_discount: 0,
      line_total: 8000,
    },
  ],
};

const deletedTransaction = {
  id_transaksi: "tx-remote-2",
  short_id: "TRX-002",
  kasir_user_id: "user-2",
  kasir_username: "kasir-2",
  payment_method: "bank_transfer" as const,
  subtotal_amount: 15000,
  item_discount: 0,
  order_discount: 0,
  total_amount: 15000,
  counts_for_cash: false,
  note: "transaksi terhapus",
  is_deleted: true,
  editedAt: Date.parse("2026-06-01T03:00:00.000Z"),
  editedByUserId: "user-2",
  editedByUsername: "editor",
  deletedAt: Date.parse("2026-06-01T03:10:00.000Z"),
  deletedByUserId: "user-3",
  deletedByUsername: "deleter",
  client_timestamp: Date.parse("2026-06-01T03:00:00.000Z"),
  createdAt: Date.parse("2026-06-01T03:05:00.000Z"),
  lines: [],
};

vi.mock("@/features/inventory/hooks/use-product-catalog", () => ({
  useProductCatalog: () => ({
    products: [],
    loading: false,
    error: null,
  }),
}));

vi.mock("@/features/pos/hooks/use-printer-bridge-settings", () => ({
  usePrinterBridgeSettings: () => ({
    settings: {
      qzHost: "localhost",
      qzUseSecure: true,
      qzSecurePorts: "8181",
      qzInsecurePorts: "8182",
      qzPrinterName: "",
      qzSigningMode: "unsigned",
      qzCertificatePem: "",
      qzSignEndpoint: "",
      qzClientPrivateKeyPem: "",
      storeName: "ASIATEK POS",
      storeDescription: "Toko",
      footerMessage: "Terima kasih",
    },
    loading: false,
  }),
}));

vi.mock("@/features/pos/hooks/use-pos-transactions", () => ({
  usePosTransactions: () => ({
    rows: [activeTransaction, deletedTransaction],
    loading: false,
    syncing: false,
    page: 2,
    pageSize: 10,
    hasPreviousPage: true,
    hasNextPage: true,
    dateFrom: "2026-06-01",
    dateTo: "2026-06-01",
    setDateFrom,
    setDateTo,
    goToPreviousPage,
    goToNextPage,
    reload,
    updateTransaction,
    softDeleteTransaction,
    restoreTransaction,
  }),
}));

describe("pos transaction screen contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders today filters, expands transaction details, and supports paging controls", () => {
    render(<PosTransactionsScreen />);

    const fromInput = screen.getByLabelText("Tanggal mulai") as HTMLInputElement;
    const toInput = screen.getByLabelText("Tanggal akhir") as HTMLInputElement;
    expect(fromInput.value).toBe("2026-06-01");
    expect(toInput.value).toBe("2026-06-01");

    fireEvent.change(fromInput, { target: { value: "2026-05-31" } });
    fireEvent.change(toInput, { target: { value: "2026-06-02" } });
    expect(setDateFrom).toHaveBeenCalledWith("2026-05-31");
    expect(setDateTo).toHaveBeenCalledWith("2026-06-02");

    fireEvent.click(screen.getByRole("button", { name: "Detail transaksi TRX-001" }));
    expect(screen.getByText("Kopi Susu Spesial")).toBeInTheDocument();
    expect(screen.getByText("Roti Bakar")).toBeInTheDocument();
    expect(screen.getByText("dibayar tunai")).toBeInTheDocument();
    expect(screen.getByText(/1,1 x Rp\s*10\.000/)).toBeInTheDocument();
    expect(screen.getByText(/0,5 x Rp\s*6\.000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Halaman sebelumnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Halaman berikutnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh transaksi" }));

    expect(goToPreviousPage).toHaveBeenCalledTimes(1);
    expect(goToNextPage).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("shows print and edit actions and marks deleted transactions", () => {
    render(<PosTransactionsScreen />);

    expect(screen.getByRole("button", { name: "Print ulang transaksi TRX-001" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit transaksi TRX-001" })).toBeInTheDocument();
    expect(screen.getByText("Terhapus")).toBeInTheDocument();
  });

  it("opens deleted transaction edit dialog in disabled state until restored", () => {
    render(<PosTransactionsScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Edit transaksi TRX-002" }));

    expect(screen.getByText(/Transaksi ini sedang dinonaktifkan/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktifkan kembali" })).toBeInTheDocument();
    expect(screen.getByLabelText("Catatan transaksi")).toBeDisabled();
  });

  it("updates the open dialog audit state and shows a success banner after saving", async () => {
    const user = userEvent.setup();
    updateTransaction.mockResolvedValueOnce({
      ...activeTransaction,
      note: "catatan tersimpan",
      editedAt: Date.parse("2026-06-09T11:00:00.000Z"),
      editedByUserId: "owner-1",
      editedByUsername: "owner-edit",
    });

    render(<PosTransactionsScreen />);

    await user.click(screen.getByRole("button", { name: "Edit transaksi TRX-001" }));
    await user.clear(screen.getByLabelText("Catatan transaksi"));
    await user.type(screen.getByLabelText("Catatan transaksi"), "catatan tersimpan");
    await user.click(screen.getByRole("button", { name: "Simpan perubahan" }));

    const confirmDialog = await screen.findByRole("dialog", {
      name: "Simpan perubahan transaksi?",
    });
    await user.click(within(confirmDialog).getByRole("button", { name: "Simpan" }));

    await waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          id_transaksi: "tx-remote-1",
          note: "catatan tersimpan",
        }),
      );
    });

    expect(await screen.findByText("Perubahan transaksi berhasil disimpan.")).toBeInTheDocument();
    expect(await screen.findByText(/oleh owner-edit/i)).toBeInTheDocument();
  });

  it("refreshes the open dialog after delete and restore without closing it first", async () => {
    const user = userEvent.setup();
    softDeleteTransaction.mockResolvedValueOnce({
      ...activeTransaction,
      is_deleted: true,
      editedAt: Date.parse("2026-06-09T11:05:00.000Z"),
      editedByUserId: "owner-1",
      editedByUsername: "owner-delete",
      deletedAt: Date.parse("2026-06-09T11:05:00.000Z"),
      deletedByUserId: "owner-1",
      deletedByUsername: "owner-delete",
    });
    restoreTransaction.mockResolvedValueOnce({
      ...activeTransaction,
      is_deleted: false,
      editedAt: Date.parse("2026-06-09T11:10:00.000Z"),
      editedByUserId: "owner-1",
      editedByUsername: "owner-restore",
      deletedAt: Date.parse("2026-06-09T11:05:00.000Z"),
      deletedByUserId: "owner-1",
      deletedByUsername: "owner-delete",
    });

    render(<PosTransactionsScreen />);

    await user.click(screen.getByRole("button", { name: "Edit transaksi TRX-001" }));
    await user.click(screen.getByRole("button", { name: "Delete transaksi" }));

    const deleteDialog = await screen.findByRole("dialog", { name: "Delete transaksi?" });
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete transaksi" }));

    await waitFor(() => expect(softDeleteTransaction).toHaveBeenCalledWith("tx-remote-1"));
    expect(await screen.findByText("Transaksi berhasil dinonaktifkan.")).toBeInTheDocument();
    expect(await screen.findByText(/Transaksi ini sedang dinonaktifkan/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aktifkan kembali" })).toBeInTheDocument();
    expect(screen.getByLabelText("Catatan transaksi")).toBeDisabled();
    expect(screen.getByText(/Delete terakhir: .* oleh owner-delete/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aktifkan kembali" }));

    const restoreDialog = await screen.findByRole("dialog", {
      name: "Aktifkan kembali transaksi?",
    });
    await user.click(within(restoreDialog).getByRole("button", { name: "Aktifkan kembali" }));

    await waitFor(() => expect(restoreTransaction).toHaveBeenCalledWith("tx-remote-1"));
    expect(await screen.findByText("Transaksi berhasil diaktifkan kembali.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Catatan transaksi")).toBeEnabled());
    expect(screen.queryByText(/Transaksi ini sedang dinonaktifkan/i)).not.toBeInTheDocument();
    expect(screen.getByText(/oleh owner-restore/i)).toBeInTheDocument();
  });
});
