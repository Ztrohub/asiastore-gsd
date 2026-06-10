import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const getTransaction = vi.fn();
const putTransaction = vi.fn();
const addQueue = vi.fn();
const transaction = vi.fn(async (...args: unknown[]) => {
  const callback = args.at(-1);
  if (typeof callback === "function") {
    return callback();
  }
  throw new Error("callback missing");
});

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    localSessions: { get: getSession },
    posTransactions: { get: getTransaction, put: putTransaction },
    syncQueue: { add: addQueue },
    transaction,
  },
}));

describe("transaction history mutation contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-09T10:00:00.000Z"));
    getSession.mockResolvedValue({ userId: "user-1", username: "kasir" });
    getTransaction.mockResolvedValue({
      id_transaksi: "tx-1",
      short_id: "TRX-001",
      kasir_user_id: "cashier-1",
      kasir_username: "cashier",
      payment_method: "cash",
      subtotal_amount: 10000,
      item_discount: 0,
      order_discount: 0,
      total_amount: 10000,
      amount_received: 10000,
      change_amount: 0,
      counts_for_cash: true,
      note: "catatan awal",
      is_deleted: false,
      lines: [
        {
          id_produk: "prod-1",
          nama_produk: "Produk 1",
          unit_price: 10000,
          qty: 1,
          unit_mutasi: "SMALL",
          unit_label: "pcs",
          line_discount: 0,
          line_total: 10000,
        },
      ],
      client_timestamp: Date.parse("2026-06-09T09:00:00.000Z"),
      createdAt: Date.parse("2026-06-09T09:00:00.000Z"),
    });
    addQueue.mockResolvedValue(1);
  });

  it("stamps edit audit metadata and rewrites the sync payload when a transaction is updated", async () => {
    const { updateTransactionHistory } = await import("@/features/pos/lib/transaction-history-update");

    await updateTransactionHistory({
      id_transaksi: "tx-1",
      payment_method: "bank_transfer",
      order_discount: 1000,
      note: "catatan baru",
      lines: [
        {
          id_produk: "prod-1",
          nama_produk: "Produk 1",
          unit_price: 10000,
          qty: 1,
          unit_mutasi: "SMALL",
          unit_label: "pcs",
          line_discount: 500,
          line_total: 9500,
        },
      ],
    });

    const saved = putTransaction.mock.calls[0][0];
    expect(saved.payment_method).toBe("bank_transfer");
    expect(saved.editedByUserId).toBe("user-1");
    expect(saved.editedByUsername).toBe("kasir");
    expect(saved.editedAt).toBe(Date.now());
    expect(saved.is_deleted).toBe(false);
    expect(addQueue).toHaveBeenCalledTimes(1);
  });

  it("soft deletes and restores without removing the transaction row", async () => {
    const { restoreTransactionHistory, softDeleteTransactionHistory } = await import(
      "@/features/pos/lib/transaction-history-update"
    );

    await softDeleteTransactionHistory("tx-1");
    expect(putTransaction.mock.calls[0][0]).toMatchObject({
      is_deleted: true,
      deletedByUserId: "user-1",
      deletedByUsername: "kasir",
    });

    putTransaction.mockClear();
    await restoreTransactionHistory("tx-1");
    expect(putTransaction.mock.calls[0][0]).toMatchObject({
      is_deleted: false,
      editedByUserId: "user-1",
      editedByUsername: "kasir",
    });
  });
});
