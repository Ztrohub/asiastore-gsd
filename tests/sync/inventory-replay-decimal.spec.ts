import { beforeEach, describe, expect, it, vi } from "vitest";

const findExistingEvent = vi.fn();
const createEvent = vi.fn();
const findProduct = vi.fn();
const updateProduct = vi.fn();
const transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
  callback({
    inventoryMutationEvent: {
      findUnique: findExistingEvent,
      create: createEvent,
    },
    product: {
      findUnique: findProduct,
      update: updateProduct,
    },
  }),
);

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: transaction,
  },
}));

describe("inventory replay decimal quantities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://local/test";
    findExistingEvent.mockResolvedValue(null);
    createEvent.mockResolvedValue({});
    findProduct.mockResolvedValue({
      stok_saat_ini: 10.5,
      stok_unit_besar_saat_ini: 0,
    });
    updateProduct.mockResolvedValue({});
  });

  it("preserves decimal stock when applying decimal deltas", async () => {
    const { applyInventoryDeltaBatch } = await import("@/lib/db/inventory-replay");

    const result = await applyInventoryDeltaBatch([
      {
        id_queue: "q-decimal-stock",
        id_produk: "prod-1",
        id_transaksi: "tx-1",
        id_user: "user-1",
        jenis_mutasi: "SALES_OUT",
        unit_mutasi: "SMALL",
        delta_qty: -0.5,
        logical_clock: 1,
        received_seq: 1,
        client_timestamp: 1780983459067,
      },
    ]);

    expect(updateProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stok_saat_ini: 10,
        }),
      }),
    );
    expect(result.acks).toEqual([{ id_queue: "q-decimal-stock", status: "acked" }]);
    expect(result.finalStockByProduct["prod-1"]).toBe(10);
  });

  it("acks stock-out that drives synced server stock below zero so clean devices receive the same stock", async () => {
    findProduct.mockResolvedValueOnce({
      stok_saat_ini: 0,
      stok_unit_besar_saat_ini: 0,
    });

    const { applyInventoryDeltaBatch } = await import("@/lib/db/inventory-replay");

    const result = await applyInventoryDeltaBatch([
      {
        id_queue: "q-negative-stock",
        id_produk: "prod-neg",
        id_transaksi: "tx-neg",
        id_user: "user-1",
        jenis_mutasi: "SALES_OUT",
        unit_mutasi: "SMALL",
        delta_qty: -4,
        logical_clock: 1,
        received_seq: 1,
        client_timestamp: 1781070000000,
      },
    ]);

    expect(updateProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_produk: "prod-neg" },
        data: expect.objectContaining({
          stok_saat_ini: -4,
          stok_unit_besar_saat_ini: 0,
        }),
      }),
    );
    expect(result.acks).toEqual([{ id_queue: "q-negative-stock", status: "acked" }]);
    expect(result.finalStockByProduct["prod-neg"]).toBe(-4);
  });

  it("keeps existing negative server stock when applying another stock-out", async () => {
    findProduct.mockResolvedValueOnce({
      stok_saat_ini: -4,
      stok_unit_besar_saat_ini: 0,
    });

    const { applyInventoryDeltaBatch } = await import("@/lib/db/inventory-replay");

    const result = await applyInventoryDeltaBatch([
      {
        id_queue: "q-negative-follow-up",
        id_produk: "prod-neg",
        id_transaksi: "tx-neg-2",
        id_user: "user-1",
        jenis_mutasi: "SALES_OUT",
        unit_mutasi: "SMALL",
        delta_qty: -3,
        logical_clock: 2,
        received_seq: 2,
        client_timestamp: 1781070001000,
      },
    ]);

    expect(updateProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id_produk: "prod-neg" },
        data: expect.objectContaining({
          stok_saat_ini: -7,
          stok_unit_besar_saat_ini: 0,
        }),
      }),
    );
    expect(result.acks).toEqual([{ id_queue: "q-negative-follow-up", status: "acked" }]);
    expect(result.finalStockByProduct["prod-neg"]).toBe(-7);
  });
});
