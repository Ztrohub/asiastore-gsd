import { beforeEach, describe, expect, it, vi } from "vitest";

const appMetaGet = vi.fn();
const appMetaPut = vi.fn();
const putTx = vi.fn();
const transaction = vi.fn(async (...args: unknown[]) => {
  const callback = args.at(-1);
  if (typeof callback === "function") {
    await callback();
    return;
  }
  throw new Error("callback missing");
});

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    appMeta: { get: appMetaGet, put: appMetaPut },
    posTransactions: { put: putTx },
    transaction,
  },
}));

describe("remote pos transaction pull sync contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    appMetaGet.mockResolvedValue({
      key: "pos_transactions_last_sync_cursor",
      value: "1717200000000:tx-local-10",
    });
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("imports remote transactions and advances cursor using server createdAt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        cursor: "1717203600000:tx-remote-1",
        transactions: [
          {
            id_transaksi: "tx-remote-1",
            short_id: "TRX-001",
            kasir_user_id: "user-2",
            kasir_username: "kasir-b",
            payment_method: "cash",
            subtotal_amount: 12000,
            item_discount: 0,
            order_discount: 0,
            total_amount: 12000,
            amount_received: 15000,
            change_amount: 3000,
            counts_for_cash: true,
            note: "sinkron dari device lain",
            client_timestamp: "2026-06-01T00:00:00.000Z",
            createdAt: "2026-06-01T01:00:00.000Z",
            lines: [
              {
                id_produk: "prod-1",
                nama_produk: "Kopi Susu",
                unit_price: 12000,
                qty: 1,
                line_discount: 0,
                line_total: 12000,
              },
            ],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { syncPosTransactionsFromServer } = await import("@/lib/offline/pos-transaction-history");
    await syncPosTransactionsFromServer();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sync/pos-transactions?cursor=1717200000000%3Atx-local-10",
      { cache: "no-store" },
    );
    expect(putTx).toHaveBeenCalledWith(
      expect.objectContaining({
        id_transaksi: "tx-remote-1",
        short_id: "TRX-001",
        client_timestamp: Date.parse("2026-06-01T00:00:00.000Z"),
        createdAt: Date.parse("2026-06-01T01:00:00.000Z"),
      }),
    );
    expect(appMetaPut).toHaveBeenCalledWith({
      key: "pos_transactions_last_sync_cursor",
      value: "1717203600000:tx-remote-1",
    });
  });
});
