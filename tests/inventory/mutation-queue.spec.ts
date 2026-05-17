import { beforeEach, describe, expect, it, vi } from "vitest";

const addEvent = vi.fn();
const addQueue = vi.fn();
const getSession = vi.fn();
const transaction = vi.fn(async (_mode: string, _events: unknown, _queue: unknown, cb: () => Promise<void>) => cb());

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    localSessions: { get: getSession },
    inventoryMutationEvents: { add: addEvent },
    syncQueue: { add: addQueue },
    transaction,
  },
}));

describe("offline stock mutation queue contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: "u-1" });
  });

  it("STOCK_IN appends one granular mutation event and enqueues pending row", async () => {
    const { persistStockMutation } = await import("@/features/inventory/hooks/use-stock-mutation");

    await persistStockMutation({
      jenis_mutasi: "STOCK_IN",
      id_transaksi: "tx-1",
      id_produk: "p-1",
      delta_qty: 5,
      logical_clock: 1,
    });

    const event = addEvent.mock.calls[0][0];
    const queueRow = addQueue.mock.calls[0][0];

    expect(event).toHaveProperty("id_queue");
    expect(event).toHaveProperty("id_transaksi");
    expect(event).toHaveProperty("id_produk");
    expect(event).toHaveProperty("id_user");
    expect(event).toHaveProperty("jenis_mutasi", "STOCK_IN");
    expect(event).toHaveProperty("delta_qty");
    expect(event).toHaveProperty("logical_clock");
    expect(event).toHaveProperty("client_timestamp");
    expect(queueRow.status).toBe("pending");
    expect(queueRow.entityType).toBe("inventory_mutation");
  });

  it("STOCK_ADJUSTMENT appends one event with enum and preserves append-only behavior", async () => {
    const { persistStockMutation } = await import("@/features/inventory/hooks/use-stock-mutation");
    await persistStockMutation({
      jenis_mutasi: "STOCK_IN",
      id_transaksi: "tx-1",
      id_produk: "p-1",
      delta_qty: 3,
      logical_clock: 1,
    });
    await persistStockMutation({
      jenis_mutasi: "STOCK_ADJUSTMENT",
      id_transaksi: "tx-2",
      id_produk: "p-1",
      delta_qty: -2,
      logical_clock: 2,
    });

    const firstEvent = addEvent.mock.calls[0][0];
    const secondEvent = addEvent.mock.calls[1][0];
    expect(addEvent).toHaveBeenCalledTimes(2);
    expect(secondEvent.jenis_mutasi).toBe("STOCK_ADJUSTMENT");
    expect(secondEvent.id_queue).not.toBe(firstEvent.id_queue);
  });
});
