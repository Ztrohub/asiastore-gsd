export type PosTransactionSyncCursor = {
  timestamp: number;
  id_transaksi: string;
};

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.trunc(value);
}

export function parsePosTransactionSyncCursor(value: unknown): PosTransactionSyncCursor | undefined {
  if (typeof value === "number") {
    const timestamp = normalizeTimestamp(value);
    if (timestamp === undefined) return undefined;
    return { timestamp, id_transaksi: "" };
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const [timestampRaw, ...idParts] = normalized.split(":");
  const timestamp = normalizeTimestamp(Number(timestampRaw));
  if (timestamp === undefined) {
    return undefined;
  }

  return {
    timestamp,
    id_transaksi: idParts.join(":").trim(),
  };
}

export function serializePosTransactionSyncCursor(cursor: PosTransactionSyncCursor | undefined) {
  if (!cursor) return undefined;
  return cursor.id_transaksi
    ? `${cursor.timestamp}:${cursor.id_transaksi}`
    : String(cursor.timestamp);
}

export function comparePosTransactionSyncCursor(
  left: PosTransactionSyncCursor | undefined,
  right: PosTransactionSyncCursor | undefined,
) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }
  return left.id_transaksi.localeCompare(right.id_transaksi);
}

export function maxPosTransactionSyncCursor(
  left: PosTransactionSyncCursor | undefined,
  right: PosTransactionSyncCursor | undefined,
) {
  return comparePosTransactionSyncCursor(left, right) >= 0 ? left : right;
}

export function buildPosTransactionCursorQuery(cursor?: string) {
  if (!cursor) {
    return "/api/sync/pos-transactions";
  }
  return `/api/sync/pos-transactions?cursor=${encodeURIComponent(cursor)}`;
}
