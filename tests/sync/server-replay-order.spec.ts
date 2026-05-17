import { describe, expect, it } from "vitest";

describe("deterministic server replay ordering", () => {
  it("applies FIFO receive order and tie-breaks by smallest client_timestamp", async () => {
    const { applyInventoryDeltaBatch } = await import("@/lib/db/inventory-replay");

    const input = [
      {
        id_queue: "q-1",
        id_produk: "p-1",
        id_transaksi: "tx-1",
        jenis_mutasi: "STOCK_IN",
        delta_qty: 10,
        received_seq: 1,
        client_timestamp: 2000,
      },
      {
        id_queue: "q-2",
        id_produk: "p-1",
        id_transaksi: "tx-2",
        jenis_mutasi: "SALES_OUT",
        delta_qty: -3,
        received_seq: 2,
        client_timestamp: 1100,
      },
      {
        id_queue: "q-3",
        id_produk: "p-1",
        id_transaksi: "tx-3",
        jenis_mutasi: "STOCK_ADJUSTMENT",
        delta_qty: -2,
        received_seq: 2,
        client_timestamp: 1000,
      },
    ];

    const result = await applyInventoryDeltaBatch(input);

    expect(result.appliedOrder).toEqual(["q-1", "q-3", "q-2"]);
    expect(result.acks).toEqual([
      { id_queue: "q-1", status: "acked" },
      { id_queue: "q-3", status: "acked" },
      { id_queue: "q-2", status: "acked" },
    ]);
  });

  it("allows negative final stock while preserving sequential transactional apply", async () => {
    const { applyInventoryDeltaBatch } = await import("@/lib/db/inventory-replay");
    const batch = [
      {
        id_queue: "q-4",
        id_produk: "p-neg",
        id_transaksi: "tx-4",
        jenis_mutasi: "SALES_OUT",
        delta_qty: -5,
        received_seq: 1,
        client_timestamp: 1000,
      },
      {
        id_queue: "q-5",
        id_produk: "p-neg",
        id_transaksi: "tx-5",
        jenis_mutasi: "SALES_OUT",
        delta_qty: -3,
        received_seq: 2,
        client_timestamp: 1001,
      },
    ];

    const result = await applyInventoryDeltaBatch(batch);

    expect(result.finalStockByProduct["p-neg"]).toBe(-8);
    expect(result.transactionMode).toBe("sequential");
    expect(result.orderingPolicy).toBe("fifo_server_receive_then_client_timestamp");
  });
});
