import { beforeEach, describe, expect, it, vi } from "vitest";

const addEvent = vi.fn();
const addQueue = vi.fn();
const getProduct = vi.fn();
const putProduct = vi.fn();
const getSession = vi.fn();
const transaction = vi.fn(async (...args: unknown[]) => {
  const callback = args.at(-1);
  if (typeof callback === "function") {
    return callback();
  }
  throw new Error("Transaction callback tidak ditemukan.");
});

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    localSessions: { get: getSession },
    products: { get: getProduct, put: putProduct },
    inventoryMutationEvents: { add: addEvent },
    syncQueue: { add: addQueue },
    transaction,
  },
}));

describe("offline stock mutation queue contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: "u-1" });
    getProduct.mockResolvedValue({
      id_produk: "p-1",
      nama_produk: "Produk uji",
      harga_jual: 12000,
      stok_saat_ini: 10,
      stok_unit_besar_saat_ini: 2,
      is_active: true,
      updatedAt: Date.now(),
    });
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
    const updatedProduct = putProduct.mock.calls[0][0];

    expect(event).toHaveProperty("id_queue");
    expect(event).toHaveProperty("id_transaksi");
    expect(event).toHaveProperty("id_produk");
    expect(event).toHaveProperty("id_user");
    expect(event).toHaveProperty("jenis_mutasi", "STOCK_IN");
    expect(event).toHaveProperty("delta_qty");
    expect(event).toHaveProperty("logical_clock");
    expect(event).toHaveProperty("client_timestamp");
    expect(updatedProduct.stok_saat_ini).toBe(15);
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
    const secondUpdatedProduct = putProduct.mock.calls[1][0];
    expect(addEvent).toHaveBeenCalledTimes(2);
    expect(secondEvent.jenis_mutasi).toBe("STOCK_ADJUSTMENT");
    expect(secondUpdatedProduct.stok_saat_ini).toBe(8);
    expect(secondEvent.id_queue).not.toBe(firstEvent.id_queue);
  });

  it("STOCK_IN unit besar hanya menambah stok unit besar", async () => {
    const { persistStockMutation } = await import("@/features/inventory/hooks/use-stock-mutation");

    await persistStockMutation({
      jenis_mutasi: "STOCK_IN",
      id_transaksi: "tx-3",
      id_produk: "p-1",
      unit_mutasi: "LARGE",
      delta_qty: 3,
      logical_clock: 3,
    });

    const event = addEvent.mock.calls[0][0];
    const updatedProduct = putProduct.mock.calls[0][0];

    expect(event.unit_mutasi).toBe("LARGE");
    expect(updatedProduct.stok_saat_ini).toBe(10);
    expect(updatedProduct.stok_unit_besar_saat_ini).toBe(5);
  });
});
