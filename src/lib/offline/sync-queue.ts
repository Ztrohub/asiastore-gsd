import { offlineDb, type SyncQueueRecord } from "@/lib/offline/db";

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60 * 1_000;

export type SyncQueueFailureMeta = {
  reason?: string;
  code?: string;
  at?: number;
};

export function calculateNextRetryAt(attemptCount: number, now = Date.now()) {
  if (attemptCount <= 0) {
    return now;
  }
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attemptCount - 1), MAX_BACKOFF_MS);
  return now + delay;
}

export async function enqueueDelta(params: {
  entityType: string;
  entityId: string;
  deltaPayload: string;
  allowNegativeStock: boolean;
}) {
  const record: SyncQueueRecord = {
    status: "pending",
    attemptCount: 0,
    nextRetryAt: Date.now(),
    entityType: params.entityType,
    entityId: params.entityId,
    deltaPayload: params.deltaPayload,
    allowNegativeStock: params.allowNegativeStock,
    createdAt: Date.now(),
  };
  const id = await offlineDb.syncQueue.add(record);
  if (typeof id !== "number") {
    throw new Error("Gagal menambahkan antrean sinkronisasi.");
  }
  return id;
}

export async function getRetryableInventoryQueue(now = Date.now()) {
  return offlineDb.syncQueue
    .where("status")
    .equals("pending")
    .and((row) => row.entityType === "inventory_mutation" && row.nextRetryAt <= now)
    .sortBy("createdAt");
}

export async function getRetryableQueueByEntity(entityType: string, now = Date.now()) {
  return offlineDb.syncQueue
    .where("status")
    .equals("pending")
    .and((row) => row.entityType === entityType && row.nextRetryAt <= now)
    .sortBy("createdAt");
}

export async function markSendFailed(id: number, meta?: SyncQueueFailureMeta) {
  const current = await offlineDb.syncQueue.get(id);
  if (!current) return;

  const now = Date.now();
  const nextAttemptCount = current.attemptCount + 1;
  const reason = meta?.reason ?? current.lastErrorReason;
  const code = meta?.code ?? current.lastErrorCode;
  const errorAt = reason ? (meta?.at ?? now) : current.lastErrorAt;

  await offlineDb.syncQueue.update(id, {
    status: "pending",
    attemptCount: nextAttemptCount,
    lastAttemptAt: now,
    nextRetryAt: calculateNextRetryAt(nextAttemptCount, now),
    lastErrorReason: reason,
    lastErrorCode: code,
    lastErrorAt: errorAt,
  });
}

export async function markAcked(id: number) {
  await offlineDb.syncQueue.update(id, {
    status: "acked",
    lastAttemptAt: Date.now(),
    lastErrorReason: undefined,
    lastErrorCode: undefined,
    lastErrorAt: undefined,
  });
}

export async function markFailed(id: number, meta?: SyncQueueFailureMeta) {
  const current = await offlineDb.syncQueue.get(id);
  if (!current) return;

  const now = Date.now();
  const reason = meta?.reason ?? current.lastErrorReason;
  const code = meta?.code ?? current.lastErrorCode;
  const errorAt = reason ? (meta?.at ?? now) : current.lastErrorAt;

  await offlineDb.syncQueue.update(id, {
    status: "failed",
    lastAttemptAt: now,
    lastErrorReason: reason,
    lastErrorCode: code,
    lastErrorAt: errorAt,
  });
}

type ReviveFailedQueueOptions = {
  now?: number;
  entityTypes?: string[];
  minAttemptCount?: number;
};

export async function reviveFailedQueue(options?: ReviveFailedQueueOptions) {
  const now = options?.now ?? Date.now();
  const minAttemptCount = options?.minAttemptCount ?? 0;
  const entityTypes = options?.entityTypes ?? [];

  const failedRows = await offlineDb.syncQueue
    .where("status")
    .equals("failed")
    .and((row) => {
      if (row.attemptCount < minAttemptCount) {
        return false;
      }
      if (entityTypes.length === 0) {
        return true;
      }
      return entityTypes.includes(row.entityType);
    })
    .toArray();

  await Promise.all(
    failedRows.map((row) =>
      offlineDb.syncQueue.update(row.id!, {
        status: "pending",
        attemptCount: 0,
        lastAttemptAt: undefined,
        nextRetryAt: now,
      }),
    ),
  );

  return failedRows.length;
}

export async function reviveFailedInventoryQueue(now = Date.now()) {
  return reviveFailedQueue({
    now,
    entityTypes: ["inventory_mutation"],
  });
}

export async function requeueSyncItem(id: number, now = Date.now()) {
  const current = await offlineDb.syncQueue.get(id);
  if (!current) return false;

  await offlineDb.syncQueue.update(id, {
    status: "pending",
    nextRetryAt: now,
    lastAttemptAt: undefined,
    lastErrorReason: undefined,
    lastErrorCode: undefined,
    lastErrorAt: undefined,
  });

  return true;
}

function formatRetryTime(timestamp: number) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function resolveUnsyncedQueueReason(row: SyncQueueRecord, now = Date.now()) {
  if (row.lastErrorReason?.trim()) {
    return row.lastErrorReason.trim();
  }
  if (row.status === "failed") {
    if (row.attemptCount === 0) {
      return "Gagal sinkronisasi (data lama tanpa detail error). Gunakan tombol Retry untuk coba ulang.";
    }
    return "Sinkronisasi gagal dan memerlukan pengecekan manual.";
  }
  if (row.nextRetryAt > now && row.attemptCount > 0) {
    return `Menunggu retry otomatis berikutnya pada ${formatRetryTime(row.nextRetryAt)}.`;
  }
  if (row.attemptCount > 0) {
    return "Menunggu proses retry sinkronisasi.";
  }
  return "Menunggu proses sinkronisasi awal.";
}
