"use client";

import { useState } from "react";
import { createPosTransactionId } from "@/lib/transactions/pos-transaction-id";
import {
  offlineDb,
  type PosPaymentMethod,
  type PosTransactionRecord,
  type InventoryMutationUnit,
} from "@/lib/offline/db";
import { persistStockOutMutation } from "@/features/pos/hooks/use-stock-out-mutation";

export type { PosPaymentMethod } from "@/lib/offline/db";

export type CheckoutLineInput = {
  id_produk: string;
  nama_produk: string;
  unit_price: number;
  qty: number;
  unit_mutasi?: InventoryMutationUnit;
  unit_label?: string;
  line_discount?: number;
};

export type CheckoutInput = {
  lines: CheckoutLineInput[];
  payment_method: PosPaymentMethod;
  amount_received?: number;
  order_discount?: number;
  note?: string;
};

export function computeCheckoutTotals(lines: CheckoutLineInput[], orderDiscount = 0) {
  const subtotal = lines.reduce((sum, line) => sum + line.unit_price * line.qty, 0);
  const itemDiscount = lines.reduce((sum, line) => {
    const maxDiscount = line.unit_price * line.qty;
    const value = Math.max(0, Math.min(line.line_discount ?? 0, maxDiscount));
    return sum + value;
  }, 0);
  const subtotalAfterItem = Math.max(0, subtotal - itemDiscount);
  const normalizedOrderDiscount = Math.max(0, Math.min(orderDiscount, subtotalAfterItem));
  const total = Math.max(0, subtotalAfterItem - normalizedOrderDiscount);

  return { subtotal, itemDiscount, orderDiscount: normalizedOrderDiscount, total };
}

export async function persistPosTransaction(input: CheckoutInput) {
  const activeSession = await offlineDb.localSessions.get("active");
  if (!activeSession?.userId) {
    throw new Error("Sesi user tidak ditemukan.");
  }
  if (input.lines.length === 0) {
    throw new Error("Cart masih kosong");
  }

  const totals = computeCheckoutTotals(input.lines, input.order_discount ?? 0);
  const receivedDefault = totals.total;
  const amountReceived = input.payment_method === "cash" ? (input.amount_received ?? receivedDefault) : undefined;
  if (input.payment_method === "cash" && amountReceived! < totals.total) {
    throw new Error("Nominal kurang");
  }

  const now = Date.now();
  const transactionId = crypto.randomUUID();
  const shortId = createPosTransactionId(new Date(now), now % 100000);
  const normalizedLines = input.lines.map((line) => {
    const baseTotal = line.unit_price * line.qty;
    const discount = Math.max(0, Math.min(line.line_discount ?? 0, baseTotal));
    return {
      ...line,
      line_discount: discount,
      line_total: Math.max(0, baseTotal - discount),
    };
  });

  const payload: PosTransactionRecord = {
    id_transaksi: transactionId,
    short_id: shortId,
    kasir_user_id: activeSession.userId,
    kasir_username: activeSession.username,
    payment_method: input.payment_method,
    subtotal_amount: totals.subtotal,
    item_discount: totals.itemDiscount,
    order_discount: totals.orderDiscount,
    total_amount: totals.total,
    amount_received: amountReceived,
    change_amount: input.payment_method === "cash" ? amountReceived! - totals.total : undefined,
    counts_for_cash: input.payment_method === "cash",
    note: input.note?.trim() || undefined,
    lines: normalizedLines,
    client_timestamp: now,
    createdAt: now,
  };

  await offlineDb.transaction("rw", offlineDb.posTransactions, offlineDb.syncQueue, async () => {
    await offlineDb.posTransactions.put(payload);
    await offlineDb.syncQueue.add({
      status: "pending",
      attemptCount: 0,
      nextRetryAt: now,
      entityType: "pos_transaction",
      entityId: payload.id_transaksi,
      deltaPayload: JSON.stringify(payload),
      allowNegativeStock: true,
      createdAt: now,
    });
  });

  await Promise.all(
    normalizedLines.map((line, index) =>
      persistStockOutMutation({
        id_transaksi: payload.id_transaksi,
        id_produk: line.id_produk,
        delta_qty: line.qty,
        unit_mutasi: line.unit_mutasi ?? "SMALL",
        logical_clock: index + 1,
      }),
    ),
  );

  return payload;
}

export function usePosCheckout() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitCheckout(input: CheckoutInput) {
    setSubmitting(true);
    setError(null);
    try {
      return await persistPosTransaction(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout gagal";
      setError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitCheckout, submitting, error };
}
