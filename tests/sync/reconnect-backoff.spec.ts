import { beforeEach, describe, expect, it, vi } from "vitest";

const getPendingQueue = vi.fn();
const markAttempt = vi.fn();
const markAcked = vi.fn();
const markFailed = vi.fn();
const postInventoryDeltas = vi.fn();

vi.mock("@/lib/offline/sync-queue", () => ({
  getRetryableInventoryQueue: getPendingQueue,
  markAttempt,
  markAcked,
  markFailed,
}));

vi.mock("@/lib/offline/inventory-sync-transport", () => ({
  postInventoryDeltas,
}));

describe("inventory reconnect sync and retry backoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("auto-pushes pending delta events when online and on periodic tick", async () => {
    getPendingQueue.mockResolvedValue([
      {
        id: 12,
        status: "pending",
        attemptCount: 0,
        entityType: "inventory_mutation",
        entityId: "q-12",
        deltaPayload: JSON.stringify({
          id_queue: "q-12",
          id_transaksi: "tx-100",
          id_produk: "p-1",
          jenis_mutasi: "SALES_OUT",
          delta_qty: -2,
          logical_clock: 4,
          client_timestamp: 10,
        }),
      },
    ]);
    postInventoryDeltas.mockResolvedValue({
      ok: true,
      results: [{ id_queue: "q-12", status: "acked" }],
    });

    const { startInventorySyncLoop } = await import("@/lib/offline/inventory-sync");
    const stop = startInventorySyncLoop({ intervalMs: 5_000 });

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);

    expect(postInventoryDeltas).toHaveBeenCalledTimes(1);
    expect(markAttempt).toHaveBeenCalledWith(12, false);
    expect(markAcked).toHaveBeenCalledWith(12);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(postInventoryDeltas).toHaveBeenCalledTimes(2);

    stop();
  });

  it("caps retries at 5 attempts, marks unstable, and exposes manual retry path", async () => {
    getPendingQueue.mockResolvedValue([
      {
        id: 13,
        status: "pending",
        attemptCount: 4,
        entityType: "inventory_mutation",
        entityId: "q-13",
        deltaPayload: JSON.stringify({
          id_queue: "q-13",
          id_transaksi: "tx-101",
          id_produk: "p-2",
          jenis_mutasi: "STOCK_ADJUSTMENT",
          delta_qty: -20,
          logical_clock: 9,
          client_timestamp: 20,
        }),
      },
    ]);
    postInventoryDeltas.mockRejectedValue(new Error("network down"));

    const { retryInventorySyncNow, startInventorySyncLoop } = await import(
      "@/lib/offline/inventory-sync"
    );
    const stop = startInventorySyncLoop({ intervalMs: 5_000 });

    await retryInventorySyncNow();
    await vi.advanceTimersByTimeAsync(0);

    expect(markAttempt).toHaveBeenCalledWith(13, true);
    expect(markAttempt).toHaveBeenCalledTimes(1);

    const { getInventorySyncStatus } = await import("@/lib/offline/inventory-sync");
    expect(getInventorySyncStatus()).toEqual(
      expect.objectContaining({
        unstable: true,
        retryExhausted: true,
        maxAttempts: 5,
        states: expect.arrayContaining(["pending", "sent", "acked", "failed"]),
        canManualRetry: true,
      }),
    );

    stop();
  });
});
