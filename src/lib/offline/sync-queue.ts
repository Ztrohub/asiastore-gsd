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

export async function markAttempt(id: number, failed: boolean) {
  const current = await offlineDb.syncQueue.get(id);
  if (!current) return;

  const nextAttemptCount = current.attemptCount + 1;
  const status = failed ? "failed" : "sent";
  await offlineDb.syncQueue.update(id, {
    status,
    attemptCount: nextAttemptCount,
    lastAttemptAt: Date.now(),
    nextRetryAt: calculateNextRetryAt(nextAttemptCount),
  });
}

export async function markAcked(id: number) {
  await offlineDb.syncQueue.update(id, { status: "acked" });
}
