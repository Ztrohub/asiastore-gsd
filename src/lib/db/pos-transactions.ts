import { PosPaymentMethod, type Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db/prisma";
import type { PosLinePricingSnapshot } from "@/lib/pricing/special-price";
import { parsePosTransactionSyncCursor } from "@/lib/sync/pos-transaction-sync-cursor";

export const POS_TRANSACTION_SYNC_BATCH_SIZE = 100;

export type PosTransactionBatchInput = {
  id_transaksi: string;
  short_id: string;
  kasir_user_id: string;
  kasir_username: string;
  payment_method: "cash" | "bank_transfer";
  subtotal_amount: number;
  item_discount: number;
  order_discount: number;
  total_amount: number;
  amount_received?: number;
  change_amount?: number;
  counts_for_cash: boolean;
  note?: string;
  is_deleted?: boolean;
  editedAt?: number;
  editedByUserId?: string;
  editedByUsername?: string;
  deletedAt?: number;
  deletedByUserId?: string;
  deletedByUsername?: string;
  client_timestamp: number;
  lines: Array<{
    id_produk: string;
    nama_produk: string;
    unit_price: number;
    qty: number;
    unit_mutasi?: "SMALL" | "LARGE";
    unit_label?: string;
    line_discount: number;
    line_total: number;
    pricing_snapshot?: PosLinePricingSnapshot;
  }>;
};

function mapPaymentMethod(value: "cash" | "bank_transfer") {
  return value === "cash" ? PosPaymentMethod.CASH : PosPaymentMethod.BANK_TRANSFER;
}

function mapPaymentMethodFromDb(value: PosPaymentMethod) {
  return value === PosPaymentMethod.CASH ? "cash" : "bank_transfer";
}

function serializePricingSnapshot(snapshot?: PosLinePricingSnapshot) {
  return snapshot ? (snapshot as Prisma.InputJsonValue) : null;
}

function deserializePricingSnapshot(value: Prisma.JsonValue | null | undefined) {
  return (value ?? undefined) as PosLinePricingSnapshot | undefined;
}

export function getPosTransactionSyncTime(transaction: { createdAt: Date }) {
  return transaction.createdAt.getTime();
}

export async function createPosTransactionBatch(transactions: PosTransactionBatchInput[]) {
  const results: Array<{ id_transaksi: string; status: "acked" | "failed" }> = [];

  for (const tx of transactions) {
    try {
      await prisma.$transaction(async (trx) => {
        await trx.posTransaction.upsert({
          where: { id_transaksi: tx.id_transaksi },
          update: {
            short_id: tx.short_id,
            kasir_user_id: tx.kasir_user_id,
            kasir_username: tx.kasir_username,
            payment_method: mapPaymentMethod(tx.payment_method),
            subtotal_amount: Math.trunc(tx.subtotal_amount),
            item_discount: Math.trunc(tx.item_discount),
            order_discount: Math.trunc(tx.order_discount),
            total_amount: Math.trunc(tx.total_amount),
            amount_received: tx.amount_received ? Math.trunc(tx.amount_received) : null,
            change_amount: tx.change_amount ? Math.trunc(tx.change_amount) : null,
            counts_for_cash: tx.counts_for_cash,
            note: tx.note ?? null,
            is_deleted: tx.is_deleted ?? false,
            editedAt: tx.editedAt ? new Date(tx.editedAt) : null,
            editedByUserId: tx.editedByUserId ?? null,
            editedByUsername: tx.editedByUsername ?? null,
            deletedAt: tx.deletedAt ? new Date(tx.deletedAt) : null,
            deletedByUserId: tx.deletedByUserId ?? null,
            deletedByUsername: tx.deletedByUsername ?? null,
            client_timestamp: new Date(tx.client_timestamp),
          },
          create: {
            id_transaksi: tx.id_transaksi,
            short_id: tx.short_id,
            kasir_user_id: tx.kasir_user_id,
            kasir_username: tx.kasir_username,
            payment_method: mapPaymentMethod(tx.payment_method),
            subtotal_amount: Math.trunc(tx.subtotal_amount),
            item_discount: Math.trunc(tx.item_discount),
            order_discount: Math.trunc(tx.order_discount),
            total_amount: Math.trunc(tx.total_amount),
            amount_received: tx.amount_received ? Math.trunc(tx.amount_received) : null,
            change_amount: tx.change_amount ? Math.trunc(tx.change_amount) : null,
            counts_for_cash: tx.counts_for_cash,
            note: tx.note ?? null,
            is_deleted: tx.is_deleted ?? false,
            editedAt: tx.editedAt ? new Date(tx.editedAt) : null,
            editedByUserId: tx.editedByUserId ?? null,
            editedByUsername: tx.editedByUsername ?? null,
            deletedAt: tx.deletedAt ? new Date(tx.deletedAt) : null,
            deletedByUserId: tx.deletedByUserId ?? null,
            deletedByUsername: tx.deletedByUsername ?? null,
            client_timestamp: new Date(tx.client_timestamp),
          },
        });

        await trx.posTransactionLine.deleteMany({
          where: { id_transaksi: tx.id_transaksi },
        });
        await trx.posTransactionLine.createMany({
          data: tx.lines.map((line) => ({
            id_transaksi: tx.id_transaksi,
            id_produk: line.id_produk,
            nama_produk: line.nama_produk,
            unit_price: Math.trunc(line.unit_price),
            qty: line.qty,
            unit_mutasi: line.unit_mutasi ?? null,
            unit_label: line.unit_label ?? null,
            line_discount: Math.trunc(line.line_discount),
            line_total: Math.trunc(line.line_total),
            pricing_snapshot: serializePricingSnapshot(line.pricing_snapshot),
          })),
        });
      });
      results.push({ id_transaksi: tx.id_transaksi, status: "acked" });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        results.push({ id_transaksi: tx.id_transaksi, status: "failed" });
        continue;
      }
      throw error;
    }
  }

  return results;
}

export async function listPosTransactions() {
  return prisma.posTransaction.findMany({
    include: { lines: true },
    orderBy: { client_timestamp: "desc" },
  });
}

export async function listPosTransactionsForSync(params?: { cursor?: string; limit?: number }) {
  const cursor = parsePosTransactionSyncCursor(params?.cursor);
  const limit = Math.max(1, Math.min(params?.limit ?? POS_TRANSACTION_SYNC_BATCH_SIZE, 250));

  const rows = await prisma.posTransaction.findMany({
    where: cursor
      ? {
          OR: [
            {
              createdAt: {
                gt: new Date(cursor.timestamp),
              },
            },
            {
              AND: [
                {
                  createdAt: new Date(cursor.timestamp),
                },
                {
                  id_transaksi: {
                    gt: cursor.id_transaksi,
                  },
                },
              ],
            },
          ],
        }
      : undefined,
    include: { lines: true },
    orderBy: [{ createdAt: "asc" }, { id_transaksi: "asc" }],
    take: limit,
  });

  return rows.map((row) => ({
    id_transaksi: row.id_transaksi,
    short_id: row.short_id,
    kasir_user_id: row.kasir_user_id,
    kasir_username: row.kasir_username,
    payment_method: mapPaymentMethodFromDb(row.payment_method),
    subtotal_amount: row.subtotal_amount,
    item_discount: row.item_discount,
    order_discount: row.order_discount,
    total_amount: row.total_amount,
    amount_received: row.amount_received ?? undefined,
    change_amount: row.change_amount ?? undefined,
    counts_for_cash: row.counts_for_cash,
    note: row.note ?? undefined,
    is_deleted: row.is_deleted,
    editedAt: row.editedAt ?? undefined,
    editedByUserId: row.editedByUserId ?? undefined,
    editedByUsername: row.editedByUsername ?? undefined,
    deletedAt: row.deletedAt ?? undefined,
    deletedByUserId: row.deletedByUserId ?? undefined,
    deletedByUsername: row.deletedByUsername ?? undefined,
    client_timestamp: row.client_timestamp,
    createdAt: row.createdAt,
    lines: row.lines.map((line) => ({
      id_produk: line.id_produk,
      nama_produk: line.nama_produk,
      unit_price: line.unit_price,
      qty: line.qty,
      unit_mutasi: line.unit_mutasi ?? undefined,
      unit_label: line.unit_label ?? undefined,
      line_discount: line.line_discount,
      line_total: line.line_total,
      pricing_snapshot: deserializePricingSnapshot(line.pricing_snapshot),
    })),
  }));
}
