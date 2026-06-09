import { describe, expect, it } from "vitest";
import { isValidInventoryDeltaEvent } from "@/lib/sync/inventory-delta-validation";

describe("inventory delta validation", () => {
  it("accepts decimal delta_qty for sync payloads", () => {
    expect(
      isValidInventoryDeltaEvent({
        id_queue: "q-decimal-1",
        id_produk: "prod-1",
        id_transaksi: "tx-1",
        id_user: "user-1",
        jenis_mutasi: "SALES_OUT",
        unit_mutasi: "SMALL",
        delta_qty: -0.5,
        logical_clock: 1,
        client_timestamp: 1780983459067,
        received_seq: 478,
      }),
    ).toBe(true);
  });

  it("rejects zero delta_qty", () => {
    expect(
      isValidInventoryDeltaEvent({
        id_queue: "q-zero-1",
        id_produk: "prod-1",
        id_transaksi: "tx-1",
        id_user: "user-1",
        jenis_mutasi: "STOCK_IN",
        unit_mutasi: "SMALL",
        delta_qty: 0,
        logical_clock: 1,
        client_timestamp: 1780983459067,
        received_seq: 478,
      }),
    ).toBe(false);
  });
});
