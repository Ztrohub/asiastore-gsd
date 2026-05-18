import { beforeEach, describe, expect, it, vi } from "vitest";

const getPendingQueue = vi.fn();
const getRetryableQueueByEntity = vi.fn();
const markAcked = vi.fn();
const markFailed = vi.fn();
const markSendFailed = vi.fn();
const reviveFailedInventoryQueue = vi.fn();
const reviveFailedQueue = vi.fn();
const postInventoryDeltas = vi.fn();
const postProductUpserts = vi.fn();
const trackedQueueRows = vi.fn();

class MockInventorySyncTransportError extends Error {
  retryable: boolean;
  status?: number;

  constructor(message: string, opts?: { retryable?: boolean; status?: number }) {
    super(message);
    this.retryable = opts?.retryable ?? true;
    this.status = opts?.status;
  }
}

vi.mock("@/lib/offline/sync-queue", () => ({
  getRetryableQueueByEntity,
  getRetryableInventoryQueue: getPendingQueue,
  markAcked,
  markFailed,
  markSendFailed,
  reviveFailedQueue,
  reviveFailedInventoryQueue,
}));

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    syncQueue: {
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          toArray: trackedQueueRows,
        })),
      })),
    },
  },
}));

vi.mock("@/lib/offline/inventory-sync-transport", () => ({
  InventorySyncTransportError: MockInventorySyncTransportError,
  postInventoryDeltas,
  postProductUpserts,
}));

describe("inventory reconnect sync and retry backoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getRetryableQueueByEntity.mockResolvedValue([]);
    trackedQueueRows.mockResolvedValue([]);
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => true,
    });
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

    expect(postInventoryDeltas).toHaveBeenCalled();
    expect(markAcked).toHaveBeenCalledWith(12);

    const callsAfterOnline = postInventoryDeltas.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(postInventoryDeltas).toHaveBeenCalledTimes(callsAfterOnline + 1);

    stop();
  });

  it("caps retries at 5 attempts, marks unstable, and exposes manual retry path", async () => {
    trackedQueueRows.mockResolvedValue([
      {
        status: "failed",
        attemptCount: 5,
        entityType: "inventory_mutation",
      },
    ]);
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

    expect(markSendFailed).toHaveBeenCalledWith(13);
    expect(markSendFailed).toHaveBeenCalledTimes(1);

    const { getInventorySyncStatus } = await import("@/lib/offline/inventory-sync");
    expect(getInventorySyncStatus()).toEqual(
      expect.objectContaining({
        unstable: true,
        retryExhausted: true,
        maxAttempts: 5,
        states: expect.arrayContaining(["pending", "acked", "failed"]),
        canManualRetry: true,
      }),
    );

    stop();
  });

  it("does not consume retry attempts while browser is offline", async () => {
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    getPendingQueue.mockResolvedValue([
      {
        id: 14,
        status: "pending",
        attemptCount: 0,
        entityType: "inventory_mutation",
        entityId: "q-14",
        deltaPayload: JSON.stringify({
          id_queue: "q-14",
          id_transaksi: "tx-102",
          id_produk: "p-3",
          jenis_mutasi: "STOCK_IN",
          delta_qty: 5,
          logical_clock: 3,
          client_timestamp: 30,
        }),
      },
    ]);
    postInventoryDeltas.mockRejectedValue(new Error("network down"));

    const { startInventorySyncLoop } = await import("@/lib/offline/inventory-sync");
    const stop = startInventorySyncLoop({ intervalMs: 5_000 });

    await vi.advanceTimersByTimeAsync(6_000);

    expect(postInventoryDeltas).not.toHaveBeenCalled();
    expect(markSendFailed).not.toHaveBeenCalled();

    stop();
  });
});
