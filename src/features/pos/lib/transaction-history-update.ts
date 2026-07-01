import { computeCheckoutTotals, type CheckoutLineInput } from "@/features/pos/hooks/use-pos-checkout";
import {
  buildLineStockEffectSnapshot,
  diffStockEffectMaps,
} from "@/features/pos/lib/stock-effects";
import { offlineDb, type PosPaymentMethod, type PosTransactionLineRecord, type PosTransactionRecord } from "@/lib/offline/db";
import type { PosLinePricingSnapshot } from "@/lib/pricing/special-price";

type EditableTransactionLine = PosTransactionLineRecord & {
  pricing_snapshot?: PosLinePricingSnapshot;
};

type PersistedTransactionRecord = Omit<PosTransactionRecord, "lines"> & {
  lines: EditableTransactionLine[];
};

export type TransactionHistoryEditableInput = {
  id_transaksi: string;
  lines: EditableTransactionLine[];
  payment_method: PosPaymentMethod;
  amount_received?: number;
  order_discount?: number;
  note?: string;
};

function normalizeLine(line: EditableTransactionLine): EditableTransactionLine {
  const automaticSubtotal = line.pricing_snapshot?.automatic_subtotal ?? line.unit_price * line.qty;
  const baseTotal = automaticSubtotal;
  const lineDiscount = Math.max(0, Math.min(Math.trunc(line.line_discount), baseTotal));

  return {
    ...line,
    unit_mutasi: line.unit_mutasi ?? undefined,
    unit_label: line.unit_label?.trim() || undefined,
    line_discount: lineDiscount,
    line_total: Math.max(0, baseTotal - lineDiscount),
  };
}

function toCheckoutLines(lines: EditableTransactionLine[]): CheckoutLineInput[] {
  return lines.map((line) => ({
    id_produk: line.id_produk,
    nama_produk: line.nama_produk,
    unit_price: line.unit_price,
    qty: line.qty,
    unit_mutasi: line.unit_mutasi,
    unit_label: line.unit_label,
    line_discount: line.line_discount,
    pricing_snapshot: line.pricing_snapshot,
  }));
}

async function requireActiveSession() {
  const activeSession = await offlineDb.localSessions.get("active");
  if (!activeSession?.userId) {
    throw new Error("Sesi user tidak ditemukan.");
  }

  return activeSession;
}

async function enqueueTransactionSync(payload: PersistedTransactionRecord, now: number) {
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
}

async function applyStockAdjustments(
  id_transaksi: string,
  deltas: Array<{ id_produk: string; unit_mutasi: "SMALL" | "LARGE"; qty_delta: number }>,
) {
  const { persistStockMutation } = await import("@/features/inventory/hooks/use-stock-mutation");
  let logicalClock = 1;
  for (const delta of deltas) {
    await persistStockMutation({
      id_transaksi,
      id_produk: delta.id_produk,
      unit_mutasi: delta.unit_mutasi,
      delta_qty: delta.qty_delta,
      jenis_mutasi: "STOCK_ADJUSTMENT",
      logical_clock: logicalClock,
    });
    logicalClock += 1;
  }
}

export async function updateTransactionHistory(input: TransactionHistoryEditableInput) {
  const [activeSession, current] = await Promise.all([
    requireActiveSession(),
    offlineDb.posTransactions.get(input.id_transaksi),
  ]);

  if (!current) {
    throw new Error("Transaksi tidak ditemukan.");
  }

  const normalizedLines = input.lines.map((line) => ({
    ...normalizeLine(line),
    stock_effect_snapshot: line.stock_effect_snapshot ?? buildLineStockEffectSnapshot(line),
  }));
  if (normalizedLines.length === 0) {
    throw new Error("Transaksi harus punya minimal satu item.");
  }

  const totals = computeCheckoutTotals(toCheckoutLines(normalizedLines), input.order_discount ?? 0);
  const now = Date.now();
  const amountReceived =
    input.payment_method === "cash"
      ? Math.max(totals.total, Math.trunc(input.amount_received ?? totals.total))
      : undefined;

  const nextPayload: PersistedTransactionRecord = {
    ...current,
    payment_method: input.payment_method,
    subtotal_amount: totals.subtotal,
    item_discount: totals.itemDiscount,
    order_discount: totals.orderDiscount,
    total_amount: totals.total,
    amount_received: amountReceived,
    change_amount:
      input.payment_method === "cash" ? Math.max(0, (amountReceived ?? totals.total) - totals.total) : undefined,
    counts_for_cash: input.payment_method === "cash",
    note: input.note?.trim() || undefined,
    is_deleted: false,
    editedAt: now,
    editedByUserId: activeSession.userId,
    editedByUsername: activeSession.username,
    lines: normalizedLines,
  };

  await offlineDb.transaction("rw", offlineDb.posTransactions, offlineDb.syncQueue, async () => {
    await offlineDb.posTransactions.put(nextPayload);
    await enqueueTransactionSync(nextPayload, now);
  });

  await applyStockAdjustments(
    input.id_transaksi,
    diffStockEffectMaps(current.lines as EditableTransactionLine[], normalizedLines),
  );

  return nextPayload;
}

export async function softDeleteTransactionHistory(id_transaksi: string) {
  const [activeSession, current] = await Promise.all([
    requireActiveSession(),
    offlineDb.posTransactions.get(id_transaksi),
  ]);

  if (!current) {
    throw new Error("Transaksi tidak ditemukan.");
  }

  const now = Date.now();
  const nextPayload: PosTransactionRecord = {
    ...current,
    is_deleted: true,
    editedAt: now,
    editedByUserId: activeSession.userId,
    editedByUsername: activeSession.username,
    deletedAt: now,
    deletedByUserId: activeSession.userId,
    deletedByUsername: activeSession.username,
  };

  await offlineDb.transaction("rw", offlineDb.posTransactions, offlineDb.syncQueue, async () => {
    await offlineDb.posTransactions.put(nextPayload);
    await enqueueTransactionSync(nextPayload, now);
  });

  await applyStockAdjustments(
    id_transaksi,
    diffStockEffectMaps(current.lines as EditableTransactionLine[], []),
  );

  return nextPayload;
}

export async function restoreTransactionHistory(id_transaksi: string) {
  const [activeSession, current] = await Promise.all([
    requireActiveSession(),
    offlineDb.posTransactions.get(id_transaksi),
  ]);

  if (!current) {
    throw new Error("Transaksi tidak ditemukan.");
  }

  const now = Date.now();
  const nextPayload: PosTransactionRecord = {
    ...current,
    is_deleted: false,
    editedAt: now,
    editedByUserId: activeSession.userId,
    editedByUsername: activeSession.username,
  };

  await offlineDb.transaction("rw", offlineDb.posTransactions, offlineDb.syncQueue, async () => {
    await offlineDb.posTransactions.put(nextPayload);
    await enqueueTransactionSync(nextPayload, now);
  });

  await applyStockAdjustments(
    id_transaksi,
    diffStockEffectMaps([], current.lines as EditableTransactionLine[]),
  );

  return nextPayload;
}
