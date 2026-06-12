import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const putTx = vi.fn();
const addQueue = vi.fn();
const appMetaGet = vi.fn();
const appMetaPut = vi.fn();
const transaction = vi.fn(async (...args: unknown[]) => {
  const callback = args.at(-1);
  if (typeof callback === "function") return callback();
  throw new Error("callback missing");
});

const getRetryableQueueByEntity = vi.fn();
const postPosTransactions = vi.fn();
const markAcked = vi.fn();
const markFailed = vi.fn();
const markSendFailed = vi.fn();
const persistStockOutMutation = vi.fn();

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    localSessions: { get: getSession },
    posTransactions: { put: putTx },
    syncQueue: { add: addQueue },
    appMeta: { get: appMetaGet, put: appMetaPut },
    transaction,
  },
}));

vi.mock("@/features/pos/hooks/use-stock-out-mutation", () => ({
  persistStockOutMutation,
}));

vi.mock("@/lib/offline/sync-queue", () => ({
  getRetryableQueueByEntity,
  markAcked,
  markFailed,
  markSendFailed,
}));

vi.mock("@/lib/offline/pos-sync-transport", () => ({
  postPosTransactions,
}));

const pricingSnapshot = {
  base_unit_price: 10000,
  automatic_subtotal: 17000,
  rules: [{ unit_mutasi: "SMALL" as const, qty_tenths: 5, harga: 6000 }],
  breakdown: [
    { qty: 1.1, unit_price: 10000, total: 11000, source: "base" as const },
    { qty: 0.5, unit_price: 6000, total: 6000, source: "special" as const },
  ],
};

describe("pos transaction sync contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ userId: "u-1", username: "kasir" });
    persistStockOutMutation.mockResolvedValue({});
    appMetaGet.mockResolvedValue(undefined);
    appMetaPut.mockResolvedValue(undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, cursor: "0", transactions: [] }),
    }));
    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("stores bank transfer as non-cash and enqueues pos_transaction entity type", async () => {
    const { persistPosTransaction } = await import("@/features/pos/hooks/use-pos-checkout");
    await persistPosTransaction({
      lines: [{ id_produk: "p1", nama_produk: "A", unit_price: 10000, qty: 1 }],
      payment_method: "bank_transfer",
      note: "catatan internal",
    });

    const saved = putTx.mock.calls[0][0];
    const queue = addQueue.mock.calls[0][0];
    expect(saved.counts_for_cash).toBe(false);
    expect(saved.note).toBe("catatan internal");
    expect(saved.short_id).toMatch(/^TRX-/);
    expect(queue.entityType).toBe("pos_transaction");
  });

  it("acks queued row when sync endpoint returns ack", async () => {
    const payload = { id_transaksi: "tx-1" };
    getRetryableQueueByEntity.mockResolvedValue([
      { id: 10, deltaPayload: JSON.stringify(payload) },
    ]);
    postPosTransactions.mockResolvedValue({
      results: [{ id_transaksi: "tx-1", status: "acked" }],
    });
    const { runPosSyncPass } = await import("@/lib/offline/pos-sync");
    await runPosSyncPass();
    expect(markAcked).toHaveBeenCalledWith(10);
  });

  it("submits pricing snapshots from queued transactions without stripping the payload", async () => {
    const payload = {
      id_transaksi: "tx-1",
      lines: [
        {
          id_produk: "p1",
          nama_produk: "A",
          unit_price: 10000,
          qty: 1.6,
          line_discount: 0,
          line_total: 17000,
          pricing_snapshot: pricingSnapshot,
        },
      ],
    };
    getRetryableQueueByEntity.mockResolvedValue([
      { id: 10, deltaPayload: JSON.stringify(payload) },
    ]);
    postPosTransactions.mockResolvedValue({
      results: [{ id_transaksi: "tx-1", status: "acked" }],
    });

    const { runPosSyncPass } = await import("@/lib/offline/pos-sync");
    await runPosSyncPass();

    expect(postPosTransactions).toHaveBeenCalledWith([
      expect.objectContaining({
        lines: [expect.objectContaining({ pricing_snapshot: pricingSnapshot })],
      }),
    ]);
  });

  it("persists and re-reads pricing snapshots in the server transaction batch mapping", async () => {
    vi.resetModules();

    const upsert = vi.fn().mockResolvedValue(undefined);
    const deleteMany = vi.fn().mockResolvedValue(undefined);
    const createMany = vi.fn().mockResolvedValue(undefined);
    const queryRaw = vi.fn().mockResolvedValue([{ id_transaksi: "tx-remote-1", sync_at: new Date("2026-06-01T01:00:00.000Z") }]);
    const findMany = vi.fn().mockResolvedValue([
      {
        id_transaksi: "tx-remote-1",
        short_id: "TRX-001",
        kasir_user_id: "user-1",
        kasir_username: "kasir",
        payment_method: "CASH",
        subtotal_amount: 17000,
        item_discount: 0,
        order_discount: 0,
        total_amount: 17000,
        amount_received: 20000,
        change_amount: 3000,
        counts_for_cash: true,
        note: "catatan",
        is_deleted: false,
        editedAt: null,
        editedByUserId: null,
        editedByUsername: null,
        deletedAt: null,
        deletedByUserId: null,
        deletedByUsername: null,
        client_timestamp: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-06-01T01:00:00.000Z"),
        lines: [
          {
            id_produk: "p1",
            nama_produk: "A",
            unit_price: 10000,
            qty: 1.6,
            unit_mutasi: "SMALL",
            unit_label: "pcs",
            line_discount: 0,
            line_total: 17000,
            pricing_snapshot: pricingSnapshot,
          },
        ],
      },
    ]);

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $queryRaw: queryRaw,
        $transaction: vi.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
          callback({
            posTransaction: { upsert },
            posTransactionLine: { deleteMany, createMany },
          }),
        ),
        posTransaction: { findMany },
      },
    }));
    vi.doMock("@/lib/sync/pos-transaction-sync-cursor", () => ({
      parsePosTransactionSyncCursor: vi.fn().mockReturnValue(undefined),
    }));

    const { createPosTransactionBatch, listPosTransactionsForSync } = await import(
      "@/lib/db/pos-transactions"
    );

    await createPosTransactionBatch([
      {
        id_transaksi: "tx-remote-1",
        short_id: "TRX-001",
        kasir_user_id: "user-1",
        kasir_username: "kasir",
        payment_method: "cash",
        subtotal_amount: 17000,
        item_discount: 0,
        order_discount: 0,
        total_amount: 17000,
        amount_received: 20000,
        change_amount: 3000,
        counts_for_cash: true,
        note: "catatan",
        client_timestamp: Date.parse("2026-06-01T00:00:00.000Z"),
        lines: [
          {
            id_produk: "p1",
            nama_produk: "A",
            unit_price: 10000,
            qty: 1.6,
            unit_mutasi: "SMALL",
            unit_label: "pcs",
            line_discount: 0,
            line_total: 17000,
            pricing_snapshot: pricingSnapshot,
          },
        ],
      },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          pricing_snapshot: pricingSnapshot,
        }),
      ],
    });

    const rows = await listPosTransactionsForSync();

    expect(rows[0]?.lines[0]).toMatchObject({
      pricing_snapshot: pricingSnapshot,
    });
  });

  it("keeps zero cash amounts when writing transaction batches to Prisma", async () => {
    vi.resetModules();

    const upsert = vi.fn().mockResolvedValue(undefined);
    const deleteMany = vi.fn().mockResolvedValue(undefined);
    const createMany = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $transaction: vi.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
          callback({
            posTransaction: { upsert },
            posTransactionLine: { deleteMany, createMany },
          }),
        ),
      },
    }));

    const { createPosTransactionBatch } = await import("@/lib/db/pos-transactions");

    await createPosTransactionBatch([
      {
        id_transaksi: "tx-free-1",
        short_id: "TRX-FREE",
        kasir_user_id: "user-1",
        kasir_username: "kasir",
        payment_method: "cash",
        subtotal_amount: 0,
        item_discount: 0,
        order_discount: 0,
        total_amount: 0,
        amount_received: 0,
        change_amount: 0,
        counts_for_cash: true,
        note: "gratis",
        client_timestamp: Date.parse("2026-06-01T00:00:00.000Z"),
        lines: [
          {
            id_produk: "p1",
            nama_produk: "Promo",
            unit_price: 0,
            qty: 1,
            line_discount: 0,
            line_total: 0,
          },
        ],
      },
    ]);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          amount_received: 0,
          change_amount: 0,
        }),
        create: expect.objectContaining({
          amount_received: 0,
          change_amount: 0,
        }),
      }),
    );
  });

  it("includes edited transactions in sync reads based on the latest change timestamp", async () => {
    vi.resetModules();

    const editedAt = new Date("2026-06-01T03:00:00.000Z");
    const queryRaw = vi.fn().mockResolvedValue([{ id_transaksi: "tx-remote-1", sync_at: editedAt }]);
    const findMany = vi.fn(async (args?: { where?: { id_transaksi?: { in?: string[] } } }) => {
      if (args?.where?.id_transaksi?.in) {
        return [
          {
            id_transaksi: "tx-remote-1",
            short_id: "TRX-001",
            kasir_user_id: "user-1",
            kasir_username: "kasir",
            payment_method: "CASH",
            subtotal_amount: 17000,
            item_discount: 0,
            order_discount: 0,
            total_amount: 17000,
            amount_received: 20000,
            change_amount: 3000,
            counts_for_cash: true,
            note: "catatan edit",
            is_deleted: false,
            editedAt,
            editedByUserId: "user-2",
            editedByUsername: "editor",
            deletedAt: null,
            deletedByUserId: null,
            deletedByUsername: null,
            client_timestamp: new Date("2026-06-01T00:00:00.000Z"),
            createdAt: new Date("2026-06-01T01:00:00.000Z"),
            lines: [
              {
                id_produk: "p1",
                nama_produk: "A",
                unit_price: 10000,
                qty: 1.6,
                unit_mutasi: "SMALL",
                unit_label: "pcs",
                line_discount: 0,
                line_total: 17000,
                pricing_snapshot: pricingSnapshot,
              },
            ],
          },
        ];
      }

      return [];
    });

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $queryRaw: queryRaw,
        posTransaction: { findMany },
      },
    }));
    vi.doMock("@/lib/sync/pos-transaction-sync-cursor", () => ({
      parsePosTransactionSyncCursor: vi.fn().mockReturnValue({
        timestamp: Date.parse("2026-06-01T02:00:00.000Z"),
        id_transaksi: "tx-remote-0",
      }),
    }));

    const { getPosTransactionSyncTime, listPosTransactionsForSync } = await import(
      "@/lib/db/pos-transactions"
    );

    const rows = await listPosTransactionsForSync({ cursor: "1717207200000:tx-remote-0" });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.editedAt?.getTime()).toBe(editedAt.getTime());
    expect(getPosTransactionSyncTime(rows[0] as { createdAt: Date; editedAt?: Date; deletedAt?: Date })).toBe(
      editedAt.getTime(),
    );
  });

  it("drops malformed pricing snapshots on write and read", async () => {
    vi.resetModules();

    const malformedSnapshot = { base_unit_price: "oops" };
    const upsert = vi.fn().mockResolvedValue(undefined);
    const deleteMany = vi.fn().mockResolvedValue(undefined);
    const createMany = vi.fn().mockResolvedValue(undefined);
    const queryRaw = vi.fn().mockResolvedValue([{ id_transaksi: "tx-remote-1", sync_at: new Date("2026-06-01T01:00:00.000Z") }]);
    const findMany = vi.fn(async (args?: { where?: { id_transaksi?: { in?: string[] } } }) => {
      if (args?.where?.id_transaksi?.in) {
        return [
          {
            id_transaksi: "tx-remote-1",
            short_id: "TRX-001",
            kasir_user_id: "user-1",
            kasir_username: "kasir",
            payment_method: "CASH",
            subtotal_amount: 17000,
            item_discount: 0,
            order_discount: 0,
            total_amount: 17000,
            amount_received: 20000,
            change_amount: 3000,
            counts_for_cash: true,
            note: "catatan",
            is_deleted: false,
            editedAt: null,
            editedByUserId: null,
            editedByUsername: null,
            deletedAt: null,
            deletedByUserId: null,
            deletedByUsername: null,
            client_timestamp: new Date("2026-06-01T00:00:00.000Z"),
            createdAt: new Date("2026-06-01T01:00:00.000Z"),
            lines: [
              {
                id_produk: "p1",
                nama_produk: "A",
                unit_price: 10000,
                qty: 1.6,
                unit_mutasi: "SMALL",
                unit_label: "pcs",
                line_discount: 0,
                line_total: 17000,
                pricing_snapshot: malformedSnapshot,
              },
            ],
          },
        ];
      }

      return [];
    });

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $queryRaw: queryRaw,
        $transaction: vi.fn(async (callback: (trx: unknown) => Promise<unknown>) =>
          callback({
            posTransaction: { upsert },
            posTransactionLine: { deleteMany, createMany },
          }),
        ),
        posTransaction: { findMany },
      },
    }));
    vi.doMock("@/lib/sync/pos-transaction-sync-cursor", () => ({
      parsePosTransactionSyncCursor: vi.fn().mockReturnValue(undefined),
    }));

    const { createPosTransactionBatch, listPosTransactionsForSync } = await import(
      "@/lib/db/pos-transactions"
    );

    await createPosTransactionBatch([
      {
        id_transaksi: "tx-remote-1",
        short_id: "TRX-001",
        kasir_user_id: "user-1",
        kasir_username: "kasir",
        payment_method: "cash",
        subtotal_amount: 17000,
        item_discount: 0,
        order_discount: 0,
        total_amount: 17000,
        amount_received: 20000,
        change_amount: 3000,
        counts_for_cash: true,
        note: "catatan",
        client_timestamp: Date.parse("2026-06-01T00:00:00.000Z"),
        lines: [
          {
            id_produk: "p1",
            nama_produk: "A",
            unit_price: 10000,
            qty: 1.6,
            unit_mutasi: "SMALL",
            unit_label: "pcs",
            line_discount: 0,
            line_total: 17000,
            pricing_snapshot: malformedSnapshot as never,
          },
        ],
      },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          pricing_snapshot: Prisma.DbNull,
        }),
      ],
    });

    const rows = await listPosTransactionsForSync();
    expect(rows[0]?.lines[0]?.pricing_snapshot).toBeUndefined();
  });

  it("drops inconsistent pricing snapshots whose breakdown rows do not match the declared pricing rules", async () => {
    vi.resetModules();

    const inconsistentSnapshot = {
      base_unit_price: 10000,
      automatic_subtotal: 17500,
      rules: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
      breakdown: [
        { qty: 1.1, unit_price: 10000, total: 11000, source: "base" as const },
        { qty: 0.5, unit_price: 6500, total: 6500, source: "special" as const },
      ],
    };
    const queryRaw = vi.fn().mockResolvedValue([{ id_transaksi: "tx-remote-1", sync_at: new Date("2026-06-01T01:00:00.000Z") }]);
    const findMany = vi.fn(async (args?: { where?: { id_transaksi?: { in?: string[] } } }) => {
      if (args?.where?.id_transaksi?.in) {
        return [
          {
            id_transaksi: "tx-remote-1",
            short_id: "TRX-001",
            kasir_user_id: "user-1",
            kasir_username: "kasir",
            payment_method: "CASH",
            subtotal_amount: 17500,
            item_discount: 0,
            order_discount: 0,
            total_amount: 17500,
            amount_received: 20000,
            change_amount: 2500,
            counts_for_cash: true,
            note: "catatan",
            is_deleted: false,
            editedAt: null,
            editedByUserId: null,
            editedByUsername: null,
            deletedAt: null,
            deletedByUserId: null,
            deletedByUsername: null,
            client_timestamp: new Date("2026-06-01T00:00:00.000Z"),
            createdAt: new Date("2026-06-01T01:00:00.000Z"),
            lines: [
              {
                id_produk: "p1",
                nama_produk: "A",
                unit_price: 10000,
                qty: 1.6,
                unit_mutasi: "SMALL",
                unit_label: "pcs",
                line_discount: 0,
                line_total: 17500,
                pricing_snapshot: inconsistentSnapshot,
              },
            ],
          },
        ];
      }

      return [];
    });

    vi.doMock("@/lib/db/prisma", () => ({
      prisma: {
        $queryRaw: queryRaw,
        posTransaction: { findMany },
      },
    }));
    vi.doMock("@/lib/sync/pos-transaction-sync-cursor", () => ({
      parsePosTransactionSyncCursor: vi.fn().mockReturnValue(undefined),
    }));

    const { listPosTransactionsForSync } = await import("@/lib/db/pos-transactions");

    const rows = await listPosTransactionsForSync();
    expect(rows[0]?.lines[0]?.pricing_snapshot).toBeUndefined();
  });
});
