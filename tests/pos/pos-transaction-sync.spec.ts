import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const putTx = vi.fn();
const addQueue = vi.fn();
const transaction = vi.fn(async (...args: unknown[]) => {
  const callback = args.at(-1);
  if (typeof callback === "function") return callback();
  throw new Error("callback missing");
});

const getRetryableQueueByEntity = vi.fn();
const postPosTransactions = vi.fn();
const markAcked = vi.fn();
const markFailed = vi.fn();
const markSendFailed = vi.fn();
const persistStockOutMutation = vi.fn();

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    localSessions: { get: getSession },
    posTransactions: { put: putTx },
    syncQueue: { add: addQueue },
    transaction,
  },
}));

vi.mock("@/features/pos/hooks/use-stock-out-mutation", () => ({
  persistStockOutMutation,
}));

vi.mock("@/lib/offline/sync-queue", () => ({
  getRetryableQueueByEntity,
  markAcked,
  markFailed,
  markSendFailed,
}));

vi.mock("@/lib/offline/pos-sync-transport", () => ({
  postPosTransactions,
}));

describe("pos transaction sync contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: "u-1", username: "kasir" });
    persistStockOutMutation.mockResolvedValue({});
  });

  it("stores bank transfer as non-cash and enqueues pos_transaction entity type", async () => {
    const { persistPosTransaction } = await import("@/features/pos/hooks/use-pos-checkout");
    await persistPosTransaction({
      lines: [{ id_produk: "p1", nama_produk: "A", unit_price: 10000, qty: 1 }],
      payment_method: "bank_transfer",
      note: "catatan internal",
    });

    const saved = putTx.mock.calls[0][0];
    const queue = addQueue.mock.calls[0][0];
    expect(saved.counts_for_cash).toBe(false);
    expect(saved.note).toBe("catatan internal");
    expect(saved.short_id).toMatch(/^TRX-/);
    expect(queue.entityType).toBe("pos_transaction");
  });

  it("acks queued row when sync endpoint returns ack", async () => {
    const payload = { id_transaksi: "tx-1" };
    getRetryableQueueByEntity.mockResolvedValue([
      { id: 10, deltaPayload: JSON.stringify(payload) },
    ]);
    postPosTransactions.mockResolvedValue({
      results: [{ id_transaksi: "tx-1", status: "acked" }],
    });
    const { runPosSyncPass } = await import("@/lib/offline/pos-sync");
    await runPosSyncPass();
    expect(markAcked).toHaveBeenCalledWith(10);
  });
});

