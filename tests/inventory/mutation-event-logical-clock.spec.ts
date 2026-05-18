import { describe, expect, it } from "vitest";
import { buildStockInMutationEvent } from "@/lib/inventory/mutation-event";

describe("mutation event logical_clock normalization", () => {
  it("normalizes millisecond timestamp logical_clock into int32-safe range", () => {
    const event = buildStockInMutationEvent({
      id_transaksi: "tx-1",
      id_produk: "p-1",
      id_user: "u-1",
      delta_qty: 1,
      logical_clock: 1_779_078_258_725,
    });

    expect(event.logical_clock).toBeLessThanOrEqual(2_147_483_647);
    expect(event.logical_clock).toBeGreaterThan(0);
  });
});
