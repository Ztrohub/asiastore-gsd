import { describe, expect, it } from "vitest";

describe("offline stock mutation queue contract (RED)", () => {
  it("STOCK_IN appends one granular mutation event and enqueues pending row", () => {
    const persistedEvent = {};
    const queueRow = { status: "sent" };

    expect(persistedEvent).toHaveProperty("id_queue");
    expect(persistedEvent).toHaveProperty("id_transaksi");
    expect(persistedEvent).toHaveProperty("id_produk");
    expect(persistedEvent).toHaveProperty("id_user");
    expect(persistedEvent).toHaveProperty("jenis_mutasi", "STOCK_IN");
    expect(persistedEvent).toHaveProperty("delta_qty");
    expect(persistedEvent).toHaveProperty("logical_clock");
    expect(persistedEvent).toHaveProperty("client_timestamp");
    expect(queueRow.status).toBe("pending");
  });

  it("STOCK_ADJUSTMENT appends one event with allowed enum and remains append-only", () => {
    const beforeCount = 0;
    const afterCount = 0;
    const adjustmentEvent = { jenis_mutasi: "INVALID" };

    expect(afterCount).toBe(beforeCount + 1);
    expect(adjustmentEvent.jenis_mutasi).toBe("STOCK_ADJUSTMENT");
  });
});
