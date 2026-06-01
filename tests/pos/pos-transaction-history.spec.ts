import { beforeEach, describe, expect, it, vi } from "vitest";

const toArray = vi.fn();
const limit = vi.fn(() => ({ toArray }));
const offset = vi.fn(() => ({ limit }));
const reverse = vi.fn(() => ({ offset }));
const between = vi.fn(() => ({ reverse }));
const where = vi.fn(() => ({ between }));

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    posTransactions: { where },
  },
}));

describe("local pos transaction history pagination contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toArray.mockResolvedValue(
      Array.from({ length: 11 }, (_, index) => ({
        id_transaksi: `tx-${index + 1}`,
        short_id: `TRX-${index + 1}`,
        kasir_user_id: "user-1",
        kasir_username: "kasir",
        payment_method: "cash",
        subtotal_amount: 10000,
        item_discount: 0,
        order_discount: 0,
        total_amount: 10000,
        counts_for_cash: true,
        client_timestamp: 1717200000000 + index,
        createdAt: 1717200000000 + index,
        lines: [],
      })),
    );
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T02:00:00.000Z"));
  });

  it("defaults the history filter to today in Jakarta", async () => {
    const { getDefaultPosTransactionFilters } = await import("@/lib/offline/pos-transaction-history");

    expect(getDefaultPosTransactionFilters()).toEqual({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-01",
    });
  });

  it("reads only the active local page window and exposes next-page state", async () => {
    const { listLocalPosTransactionsPage } = await import("@/lib/offline/pos-transaction-history");
    const page = await listLocalPosTransactionsPage({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-01",
      page: 2,
      pageSize: 10,
    });

    expect(where).toHaveBeenCalledWith("client_timestamp");
    expect(between).toHaveBeenCalledTimes(1);
    expect(offset).toHaveBeenCalledWith(10);
    expect(limit).toHaveBeenCalledWith(11);
    expect(page.rows).toHaveLength(10);
    expect(page.hasPreviousPage).toBe(true);
    expect(page.hasNextPage).toBe(true);
  });
});
