import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const putTx = vi.fn();
const addQueue = vi.fn();
const transaction = vi.fn(async (...args: unknown[]) => {
  const callback = args.at(-1);
  if (typeof callback === "function") return callback();
  throw new Error("callback missing");
});
const persistStockOutMutation = vi.fn();

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    localSessions: { get: getSession },
    posTransactions: { put: putTx },
    syncQueue: { add: addQueue },
    transaction,
  },
}));

vi.mock("@/features/pos/hooks/use-stock-out-mutation", () => ({
  persistStockOutMutation,
}));

describe("pos checkout payment rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: "u-1", username: "kasir" });
    persistStockOutMutation.mockResolvedValue({});
  });

  it("applies item discount before order discount and floors total at zero", async () => {
    const { computeCheckoutTotals } = await import("@/features/pos/hooks/use-pos-checkout");
    const totals = computeCheckoutTotals(
      [{ id_produk: "p1", nama_produk: "A", unit_price: 10000, qty: 1, line_discount: 9000 }],
      5000,
    );
    expect(totals.subtotal).toBe(10000);
    expect(totals.itemDiscount).toBe(9000);
    expect(totals.orderDiscount).toBe(1000);
    expect(totals.total).toBe(0);
  });

  it("blocks underpayment for cash and defaults amount received to total", async () => {
    const { persistPosTransaction } = await import("@/features/pos/hooks/use-pos-checkout");
    await expect(
      persistPosTransaction({
        lines: [{ id_produk: "p1", nama_produk: "A", unit_price: 10000, qty: 1 }],
        payment_method: "cash",
        amount_received: 9000,
      }),
    ).rejects.toThrow("Nominal kurang");

    await persistPosTransaction({
      lines: [{ id_produk: "p1", nama_produk: "A", unit_price: 10000, qty: 1 }],
      payment_method: "cash",
    });
    const saved = putTx.mock.calls[0][0];
    expect(saved.amount_received).toBe(10000);
    expect(saved.change_amount).toBe(0);
  });
});

