import { PosPaymentMethod, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/db/prisma";
import { normalizePricingSnapshot, type PosLinePricingSnapshot } from "@/lib/pricing/special-price";
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

function serializePricingSnapshot(snapshot: unknown) {
  const normalized = normalizePricingSnapshot(snapshot);
  return normalized ? (normalized as Prisma.InputJsonValue) : Prisma.DbNull;
}

function deserializePricingSnapshot(value: Prisma.JsonValue | null | undefined) {
  return normalizePricingSnapshot(value);
}

function getEffectiveSyncDate(transaction: {
  createdAt: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
}) {
  const candidates = [transaction.createdAt, transaction.editedAt, transaction.deletedAt].filter(
    (value): value is Date => value instanceof Date,
  );

  return candidates.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
}

export function getPosTransactionSyncTime(transaction: {
  createdAt: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
}) {
  return getEffectiveSyncDate(transaction).getTime();
}

export async function createPosTransactionBatch(transactions: PosTransactionBatchInput[]) {
  const results: Array<{ id_transaksi: string; status: "acked" | "failed" }> = [];

  for (const tx of transactions) {
    try {
      const amountReceived = typeof tx.amount_received === "number" ? Math.trunc(tx.amount_received) : null;
      const changeAmount = typeof tx.change_amount === "number" ? Math.trunc(tx.change_amount) : null;
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
            amount_received: amountReceived,
            change_amount: changeAmount,
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
            amount_received: amountReceived,
            change_amount: changeAmount,
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
  const syncTimestampSql = Prisma.sql`GREATEST("createdAt", COALESCE("editedAt", "createdAt"), COALESCE("deletedAt", "createdAt"))`;
  const syncRows = await prisma.$queryRaw<Array<{ id_transaksi: string }>>(Prisma.sql`
    SELECT "id_transaksi"
    FROM "PosTransaction"
    ${cursor
      ? Prisma.sql`
        WHERE ${syncTimestampSql} > ${new Date(cursor.timestamp)}
           OR (${syncTimestampSql} = ${new Date(cursor.timestamp)} AND "id_transaksi" > ${cursor.id_transaksi})
      `
      : Prisma.empty}
    ORDER BY ${syncTimestampSql} ASC, "id_transaksi" ASC
    LIMIT ${limit}
  `);
  const orderedIds = syncRows.map((row) => row.id_transaksi);
  if (orderedIds.length === 0) {
    return [];
  }

  const rows = await prisma.posTransaction.findMany({
    where: {
      id_transaksi: {
        in: orderedIds,
      },
    },
    include: { lines: true },
  });
  const rowsById = new Map(rows.map((row) => [row.id_transaksi, row]));

  return orderedIds
    .map((id_transaksi) => rowsById.get(id_transaksi))
    .filter((row): row is (typeof rows)[number] => Boolean(row))
    .map((row) => ({
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
