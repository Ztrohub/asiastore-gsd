import { offlineDb, type PosTransactionRecord } from "@/lib/offline/db";
import {
  buildPosTransactionCursorQuery,
  maxPosTransactionSyncCursor,
  parsePosTransactionSyncCursor,
  serializePosTransactionSyncCursor,
} from "@/lib/sync/pos-transaction-sync-cursor";

const POS_TRANSACTION_SYNC_CURSOR_KEY = "pos_transactions_last_sync_cursor";
const POS_TRANSACTION_SYNC_BATCH_SIZE = 100;
const JAKARTA_UTC_OFFSET_HOURS = 7;
const CURSOR_FUTURE_TOLERANCE_MS = 5 * 60 * 1_000;

type PosTransactionServerRecord = Omit<PosTransactionRecord, "client_timestamp" | "createdAt"> & {
  client_timestamp: string | number;
  createdAt: string | number;
};

export type PosTransactionFilters = {
  dateFrom: string;
  dateTo: string;
};

export type PosTransactionPage = {
  rows: PosTransactionRecord[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  page: number;
  pageSize: number;
};

let activeSyncPass: Promise<void> | null = null;

function isRuntimeOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function formatJakartaDateInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return undefined;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }

  return { year, month, day };
}

function getJakartaDayBounds(dateValue: string) {
  const parsed = parseDateInput(dateValue);
  if (!parsed) {
    return undefined;
  }

  const start = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    -JAKARTA_UTC_OFFSET_HOURS,
    0,
    0,
    0,
  );

  return {
    start,
    end: start + 86_399_999,
  };
}

function normalizeDateRange(filters: PosTransactionFilters) {
  const defaults = getDefaultPosTransactionFilters();
  const from = getJakartaDayBounds(filters.dateFrom) ?? getJakartaDayBounds(defaults.dateFrom)!;
  const to = getJakartaDayBounds(filters.dateTo) ?? getJakartaDayBounds(defaults.dateTo)!;

  if (from.start <= to.start) {
    return { start: from.start, end: to.end };
  }

  return { start: to.start, end: from.end };
}

function normalizeTimestamp(value: string | number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return Date.now();
}

function normalizeServerTransaction(record: PosTransactionServerRecord): PosTransactionRecord {
  return {
    ...record,
    amount_received: record.amount_received ?? undefined,
    change_amount: record.change_amount ?? undefined,
    note: record.note?.trim() || undefined,
    client_timestamp: normalizeTimestamp(record.client_timestamp),
    createdAt: normalizeTimestamp(record.createdAt),
    lines: record.lines.map((line) => ({
      ...line,
      unit_mutasi: line.unit_mutasi ?? undefined,
      unit_label: line.unit_label?.trim() || undefined,
    })),
  };
}

async function getPosTransactionSyncCursor() {
  const cursorMeta = await offlineDb.appMeta.get(POS_TRANSACTION_SYNC_CURSOR_KEY);
  const parsed = parsePosTransactionSyncCursor(cursorMeta?.value);
  if (!parsed) {
    return undefined;
  }
  if (parsed.timestamp > Date.now() + CURSOR_FUTURE_TOLERANCE_MS) {
    return undefined;
  }
  return serializePosTransactionSyncCursor(parsed);
}

async function setPosTransactionSyncCursor(cursor: string) {
  const current = parsePosTransactionSyncCursor(await getPosTransactionSyncCursor());
  const incoming = parsePosTransactionSyncCursor(cursor);
  if (!incoming) {
    return current ? serializePosTransactionSyncCursor(current) : undefined;
  }

  const nextCursor = serializePosTransactionSyncCursor(
    maxPosTransactionSyncCursor(current, incoming),
  );
  if (!nextCursor) {
    return undefined;
  }

  await offlineDb.appMeta.put({
    key: POS_TRANSACTION_SYNC_CURSOR_KEY,
    value: nextCursor,
  });

  return nextCursor;
}

function resolveCursorFromPayload(
  value: unknown,
  fallback: string | undefined,
  transactions: PosTransactionServerRecord[],
) {
  const parsed = parsePosTransactionSyncCursor(value);
  if (parsed) {
    return serializePosTransactionSyncCursor(parsed);
  }

  const lastRow = transactions[transactions.length - 1];
  if (!lastRow) {
    return fallback;
  }

  return serializePosTransactionSyncCursor({
    timestamp: normalizeTimestamp(lastRow.createdAt),
    id_transaksi: lastRow.id_transaksi,
  });
}

export function getDefaultPosTransactionFilters(now = new Date()): PosTransactionFilters {
  const today = formatJakartaDateInput(now);
  return {
    dateFrom: today,
    dateTo: today,
  };
}

export async function listLocalPosTransactionsPage(params: {
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize?: number;
}): Promise<PosTransactionPage> {
  const page = Math.max(1, Math.trunc(params.page));
  const pageSize = Math.max(1, Math.trunc(params.pageSize ?? 10));
  const offset = (page - 1) * pageSize;
  const range = normalizeDateRange({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  const rows = await offlineDb.posTransactions
    .where("client_timestamp")
    .between(range.start, range.end, true, true)
    .reverse()
    .offset(offset)
    .limit(pageSize + 1)
    .toArray();

  return {
    rows: rows.slice(0, pageSize),
    hasPreviousPage: page > 1,
    hasNextPage: rows.length > pageSize,
    page,
    pageSize,
  };
}

export async function syncPosTransactionsFromServer() {
  if (activeSyncPass) {
    return activeSyncPass;
  }

  if (!isRuntimeOnline()) {
    return Promise.resolve();
  }

  activeSyncPass = (async () => {
    let cursor = await getPosTransactionSyncCursor();

    for (let pass = 0; pass < 10; pass += 1) {
      const response = await fetch(buildPosTransactionCursorQuery(cursor), {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as {
        ok: boolean;
        cursor?: unknown;
        transactions?: PosTransactionServerRecord[];
      };
      if (!payload.ok || !Array.isArray(payload.transactions)) {
        return;
      }
      const transactions = payload.transactions;

      if (transactions.length > 0) {
        await offlineDb.transaction("rw", offlineDb.posTransactions, async () => {
          for (const transaction of transactions) {
            await offlineDb.posTransactions.put(normalizeServerTransaction(transaction));
          }
        });
      }

      const nextCursor = resolveCursorFromPayload(payload.cursor, cursor, transactions);
      const previousCursor = cursor;
      if (nextCursor) {
        cursor = (await setPosTransactionSyncCursor(nextCursor)) ?? previousCursor;
      }

      if (transactions.length < POS_TRANSACTION_SYNC_BATCH_SIZE) {
        break;
      }
      if (cursor === previousCursor) {
        break;
      }
    }
  })().finally(() => {
    activeSyncPass = null;
  });

  return activeSyncPass;
}
