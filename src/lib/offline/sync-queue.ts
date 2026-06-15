import { offlineDb, type SyncQueueRecord } from "@/lib/offline/db";

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60 * 1_000;

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
  return offlineDb.syncQueue.add(record);
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

export async function markSendFailed(id: number) {
  const current = await offlineDb.syncQueue.get(id);
  if (!current) return;

  const nextAttemptCount = current.attemptCount + 1;
  await offlineDb.syncQueue.update(id, {
    status: "pending",
    attemptCount: nextAttemptCount,
    lastAttemptAt: Date.now(),
    nextRetryAt: calculateNextRetryAt(nextAttemptCount),
  });
}

export async function markAcked(id: number) {
  await offlineDb.syncQueue.update(id, {
    status: "acked",
    lastAttemptAt: Date.now(),
  });
}

export async function markFailed(id: number) {
  await offlineDb.syncQueue.update(id, { status: "failed" });
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
