import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PosTransactionsScreen } from "@/features/pos/components/pos-transactions-screen";

const setDateFrom = vi.fn();
const setDateTo = vi.fn();
const goToPreviousPage = vi.fn();
const goToNextPage = vi.fn();
const reload = vi.fn();

vi.mock("@/features/pos/hooks/use-pos-transactions", () => ({
  usePosTransactions: () => ({
    rows: [
      {
        id_transaksi: "tx-remote-1",
        short_id: "TRX-001",
        kasir_user_id: "user-1",
        kasir_username: "kasir",
        payment_method: "cash",
        subtotal_amount: 20000,
        item_discount: 1000,
        order_discount: 0,
        total_amount: 19000,
        amount_received: 20000,
        change_amount: 1000,
        counts_for_cash: true,
        note: "dibayar tunai",
        client_timestamp: Date.parse("2026-06-01T02:00:00.000Z"),
        createdAt: Date.parse("2026-06-01T02:05:00.000Z"),
        lines: [
          {
            id_produk: "prod-1",
            nama_produk: "Kopi Susu",
            unit_price: 12000,
            qty: 1,
            line_discount: 1000,
            line_total: 11000,
          },
          {
            id_produk: "prod-2",
            nama_produk: "Roti Bakar",
            unit_price: 8000,
            qty: 1,
            line_discount: 0,
            line_total: 8000,
          },
        ],
      },
    ],
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
    expect(screen.getByText("Kopi Susu")).toBeInTheDocument();
    expect(screen.getByText("Roti Bakar")).toBeInTheDocument();
    expect(screen.getByText("dibayar tunai")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Halaman sebelumnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Halaman berikutnya" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh transaksi" }));

    expect(goToPreviousPage).toHaveBeenCalledTimes(1);
    expect(goToNextPage).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
