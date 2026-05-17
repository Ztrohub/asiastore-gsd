import { getRetryableInventoryQueue, markAcked, markAttempt, markFailed } from "@/lib/offline/sync-queue";
import { postInventoryDeltas } from "@/lib/offline/inventory-sync-transport";

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
  states: Array<"pending" | "sent" | "acked" | "failed">;
  canManualRetry: boolean;
};

const MAX_ATTEMPTS = 5;
const NON_RETRYABLE_REASONS = new Set(["PRODUCT_NOT_FOUND", "INVALID_PAYLOAD", "SCHEMA_ERROR"]);

let syncStatus: SyncStatus = {
  unstable: false,
  retryExhausted: false,
  maxAttempts: MAX_ATTEMPTS,
  states: ["pending", "sent", "acked", "failed"],
  canManualRetry: false,
};

async function runOnePass() {
  const rows = await getRetryableInventoryQueue();
  for (const row of rows) {
    if (!row.id) continue;
    if (row.attemptCount >= MAX_ATTEMPTS) {
      await markFailed(row.id);
      syncStatus = { ...syncStatus, unstable: true, retryExhausted: true, canManualRetry: true };
      continue;
    }

    try {
      const event = JSON.parse(row.deltaPayload) as InventorySyncEvent;
      const result = await postInventoryDeltas([event]);
      const ack = result.results.find((item) => item.id_queue === event.id_queue);

      if (ack?.status === "acked") {
        await markAttempt(row.id, false);
        await markAcked(row.id);
        continue;
      }

      if (ack?.status === "failed" && NON_RETRYABLE_REASONS.has(ack.reason ?? "")) {
        await markFailed(row.id);
        continue;
      }

      await markAttempt(row.id, true);
      if (row.attemptCount + 1 >= MAX_ATTEMPTS) {
        syncStatus = { ...syncStatus, unstable: true, retryExhausted: true, canManualRetry: true };
      }
    } catch {
      await markAttempt(row.id, true);
      const nextAttempts = row.attemptCount + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        await markFailed(row.id);
        syncStatus = { ...syncStatus, unstable: true, retryExhausted: true, canManualRetry: true };
      }
    }
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
