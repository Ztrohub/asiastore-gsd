import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const getProduct = vi.fn();
const putProduct = vi.fn();
const addEvent = vi.fn();
const addQueue = vi.fn();
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

describe("stock out uom conversion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: "u-1" });
    getProduct.mockResolvedValue({
      id_produk: "p-1",
      nama_produk: "Produk A",
      harga_jual: 12000,
      stok_saat_ini: 20,
      stok_unit_besar_saat_ini: 3,
      is_active: true,
      updatedAt: Date.now(),
      unit_small_name: "pcs",
      unit_large_name: "dus",
      unit_large_to_small: 12,
      allow_buy_in_small: true,
      allow_buy_in_large: true,
      allow_sell_in_small: true,
      allow_sell_in_large: true,
    });
  });

  it("reduces large-unit stock directly without converting from small stock", async () => {
    const { persistStockOutMutation } = await import("@/features/pos/hooks/use-stock-out-mutation");

    const event = await persistStockOutMutation({
      id_transaksi: "tx-sale-1",
      id_produk: "p-1",
      delta_qty: 1,
      unit_mutasi: "LARGE",
      logical_clock: 1,
    });

    expect(event.delta_qty).toBe(-1);
    expect(event.unit_mutasi).toBe("LARGE");
    expect(putProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id_produk: "p-1",
        stok_saat_ini: 20,
        stok_unit_besar_saat_ini: 2,
      }),
    );
    expect(addQueue).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "inventory_mutation",
        status: "pending",
      }),
    );
  });
});
