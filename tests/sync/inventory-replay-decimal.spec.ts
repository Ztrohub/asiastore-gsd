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
});
