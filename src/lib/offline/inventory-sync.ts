"use client";

import {
  getRetryableQueueByEntity,
  getRetryableInventoryQueue,
  markAcked,
  markFailed,
  markSendFailed,
  reviveFailedQueue,
  reviveFailedInventoryQueue,
} from "@/lib/offline/sync-queue";
import {
  InventorySyncTransportError,
  postInventoryDeltas,
  postProductUpserts,
} from "@/lib/offline/inventory-sync-transport";
import { offlineDb } from "@/lib/offline/db";

type InventorySyncEvent = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
  id_user?: string;
  jenis_mutasi: "SALES_OUT" | "STOCK_IN" | "STOCK_ADJUSTMENT";
  unit_mutasi?: "SMALL" | "LARGE";
  delta_qty: number;
  logical_clock: number;
  received_seq?: number;
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
const NON_RETRYABLE_REASONS = new Set([
  "PRODUCT_NOT_FOUND",
  "INVALID_PAYLOAD",
  "SCHEMA_ERROR",
  "MISSING_USER_ID",
]);
const NON_RETRYABLE_TRANSPORT_STATUS = new Set([400, 404, 413, 422]);
const TRACKED_ENTITY_TYPES = ["inventory_mutation", "inventory_product"] as const;
const INVENTORY_SYNC_POLL_MS = 30_000;

let syncStatus: SyncStatus = {
  unstable: false,
  retryExhausted: false,
  maxAttempts: MAX_ATTEMPTS,
  states: ["pending", "acked", "failed"],
  canManualRetry: false,
};
let activePass: Promise<void> | null = null;

function isRuntimeOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function refreshSyncStatus() {
  const queueRows = await offlineDb.syncQueue
    .where("entityType")
    .anyOf(...TRACKED_ENTITY_TYPES)
    .toArray();
  const hasFailed = queueRows.some((row) => row.status === "failed");
  const hasExhaustedPending = queueRows.some(
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

async function runOnePass() {
  if (activePass) {
    return activePass;
  }
  if (!isRuntimeOnline()) {
    return Promise.resolve();
  }

  activePass = (async () => {
    if (!isRuntimeOnline()) {
      return;
    }
    await reviveFailedQueue({
      entityTypes: [...TRACKED_ENTITY_TYPES],
      minAttemptCount: MAX_ATTEMPTS,
    });

    const productRows = await getRetryableQueueByEntity("inventory_product");
    for (const row of productRows) {
      if (!row.id) continue;
      if (row.attemptCount >= MAX_ATTEMPTS) {
        await markFailed(row.id);
        continue;
      }
      try {
        const payload = JSON.parse(row.deltaPayload) as {
          id_produk: string;
          nama_produk: string;
          sku?: string;
          harga_jual: number;
          harga_jual_unit_besar?: number;
          stok_saat_ini: number;
          stok_unit_besar_saat_ini?: number;
          is_active: boolean;
          unit_small_name?: string;
          unit_large_name?: string;
          unit_large_to_small?: number;
          allow_buy_in_small?: boolean;
          allow_buy_in_large?: boolean;
          allow_sell_in_small?: boolean;
          allow_sell_in_large?: boolean;
          updatedAt: number;
        };
        await postProductUpserts([payload]);
        await markAcked(row.id);
      } catch (error) {
        if (
          error instanceof InventorySyncTransportError &&
          (!error.retryable || NON_RETRYABLE_TRANSPORT_STATUS.has(error.status ?? 0))
        ) {
          await markFailed(row.id);
          continue;
        }
        if (!isRuntimeOnline()) {
          continue;
        }
        await markSendFailed(row.id);
        if (row.attemptCount + 1 >= MAX_ATTEMPTS) {
          await markFailed(row.id);
        }
      }
    }

    const rows = await getRetryableInventoryQueue();
    for (const row of rows) {
      if (!row.id) continue;
      if (row.attemptCount >= MAX_ATTEMPTS) {
        await markFailed(row.id);
        continue;
      }

      try {
        const event = JSON.parse(row.deltaPayload) as InventorySyncEvent;
        const eventWithSeq: InventorySyncEvent = {
          ...event,
          received_seq: row.id,
        };
        const result = await postInventoryDeltas([eventWithSeq as InventorySyncEvent & { received_seq: number }]);
        const ack = result.results.find((item) => item.id_queue === eventWithSeq.id_queue);

        if (ack?.status === "acked") {
          await markAcked(row.id);
          continue;
        }

        if (ack?.status === "failed" && NON_RETRYABLE_REASONS.has(ack.reason ?? "")) {
          await markFailed(row.id);
          continue;
        }

        await markSendFailed(row.id);
        const nextAttempts = row.attemptCount + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          await markFailed(row.id);
        }
      } catch (error) {
        if (
          error instanceof InventorySyncTransportError &&
          (!error.retryable || NON_RETRYABLE_TRANSPORT_STATUS.has(error.status ?? 0))
        ) {
          await markFailed(row.id);
          continue;
        }
        if (!isRuntimeOnline()) {
          continue;
        }

        await markSendFailed(row.id);
        const nextAttempts = row.attemptCount + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          await markFailed(row.id);
        }
      }
    }

    await refreshSyncStatus();
  })().finally(() => {
    activePass = null;
  });

  return activePass;
}

export function startInventorySyncLoop(params?: { intervalMs?: number }) {
  const intervalMs = params?.intervalMs ?? INVENTORY_SYNC_POLL_MS;
  let stopped = false;

  const run = () => {
    if (stopped) return;
    runOnePass().catch(() => undefined);
  };

  run();
  window.addEventListener("online", run);
  const timer = window.setInterval(run, intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    window.removeEventListener("online", run);
  };
}

export async function retryInventorySyncNow() {
  await reviveFailedInventoryQueue();
  await runOnePass();
}

export function getInventorySyncStatus() {
  return syncStatus;
}
