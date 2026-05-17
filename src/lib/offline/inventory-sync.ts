import { getRetryableInventoryQueue, markAcked, markFailed, markSendFailed } from "@/lib/offline/sync-queue";
import { postInventoryDeltas } from "@/lib/offline/inventory-sync-transport";
import { offlineDb } from "@/lib/offline/db";

type InventorySyncEvent = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
  id_user?: string;
  jenis_mutasi: "SALES_OUT" | "STOCK_IN" | "STOCK_ADJUSTMENT";
  delta_qty: number;
  logical_clock: number;
  client_timestamp: number;
};

type SyncStatus = {
  unstable: boolean;
  retryExhausted: boolean;
  maxAttempts: number;
  states: Array<"pending" | "acked" | "failed">;
  canManualRetry: boolean;
};

const MAX_ATTEMPTS = 5;
const NON_RETRYABLE_REASONS = new Set(["PRODUCT_NOT_FOUND", "INVALID_PAYLOAD", "SCHEMA_ERROR", "MISSING_USER_ID"]);

let syncStatus: SyncStatus = {
  unstable: false,
  retryExhausted: false,
  maxAttempts: MAX_ATTEMPTS,
  states: ["pending", "acked", "failed"],
  canManualRetry: false,
};

async function runOnePass() {
  const rows = await getRetryableInventoryQueue();
  let exhaustedThisPass = false;
  for (const row of rows) {
    if (!row.id) continue;
    if (row.attemptCount >= MAX_ATTEMPTS) {
      await markFailed(row.id);
      exhaustedThisPass = true;
      syncStatus = { ...syncStatus, unstable: true, retryExhausted: true, canManualRetry: true };
      continue;
    }

    try {
      const event = JSON.parse(row.deltaPayload) as InventorySyncEvent;
      const result = await postInventoryDeltas([event]);
      const ack = result.results.find((item) => item.id_queue === event.id_queue);

      if (ack?.status === "acked") {
        await markAcked(row.id);
        continue;
      }

      if (ack?.status === "failed" && NON_RETRYABLE_REASONS.has(ack.reason ?? "")) {
        await markFailed(row.id);
        continue;
      }

      await markSendFailed(row.id);
      if (row.attemptCount + 1 >= MAX_ATTEMPTS) {
        exhaustedThisPass = true;
        syncStatus = { ...syncStatus, unstable: true, retryExhausted: true, canManualRetry: true };
      }
    } catch {
      await markSendFailed(row.id);
      const nextAttempts = row.attemptCount + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        await markFailed(row.id);
        exhaustedThisPass = true;
        syncStatus = { ...syncStatus, unstable: true, retryExhausted: true, canManualRetry: true };
      }
    }
  }

  if (!exhaustedThisPass) {
    const inventoryRows = await offlineDb.syncQueue
      .where("entityType")
      .equals("inventory_mutation")
      .toArray();
    const hasFailed = inventoryRows.some((row) => row.status === "failed");
    const hasExhaustedPending = inventoryRows.some(
      (row) => row.status === "pending" && row.attemptCount >= MAX_ATTEMPTS,
    );
    const hasUnresolved = hasFailed || hasExhaustedPending;
    syncStatus = {
      ...syncStatus,
      unstable: hasUnresolved,
      retryExhausted: hasUnresolved,
      canManualRetry: hasUnresolved,
    };
  }
}

export function startInventorySyncLoop(params?: { intervalMs?: number }) {
  const intervalMs = params?.intervalMs ?? 5_000;
  let stopped = false;

  const run = () => {
    if (stopped) return;
    runOnePass().catch(() => undefined);
  };

  window.addEventListener("online", run);
  const timer = window.setInterval(run, intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener("online", run);
  };
}

export async function retryInventorySyncNow() {
  await runOnePass();
}

export function getInventorySyncStatus() {
  return syncStatus;
}
