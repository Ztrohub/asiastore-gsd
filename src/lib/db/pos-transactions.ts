import { Prisma, PosPaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type PosTransactionBatchInput = {
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
  client_timestamp: number;
  lines: Array<{
    id_produk: string;
    nama_produk: string;
    unit_price: number;
    qty: number;
    unit_label?: string;
    line_discount: number;
    line_total: number;
  }>;
};

function mapPaymentMethod(value: "cash" | "bank_transfer") {
  return value === "cash" ? PosPaymentMethod.CASH : PosPaymentMethod.BANK_TRANSFER;
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
            line_discount: Math.trunc(line.line_discount),
            line_total: Math.trunc(line.line_total),
          })),
        });
      });
      results.push({ id_transaksi: tx.id_transaksi, status: "acked" });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
