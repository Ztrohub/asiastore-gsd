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
const AUTH_RETRYABLE_STATUSES = new Set([401, 403]);
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

function shouldRetryTransportError(error: unknown) {
  if (!(error instanceof InventorySyncTransportError)) {
    return true;
  }

  const status = error.status ?? 0;
  if (AUTH_RETRYABLE_STATUSES.has(status)) {
    return true;
  }
  if (!error.retryable) {
    return false;
  }
  if (NON_RETRYABLE_TRANSPORT_STATUS.has(status)) {
    return false;
  }
  return true;
}

function buildTransportFailureMeta(error: unknown) {
  if (!isRuntimeOnline()) {
    return {
      reason: "Perangkat sedang offline. Menunggu koneksi internet kembali.",
      code: "OFFLINE",
    };
  }

  if (error instanceof InventorySyncTransportError) {
    const status = error.status ?? 0;
    if (AUTH_RETRYABLE_STATUSES.has(status)) {
      return {
        reason: "Sesi login tidak valid. Login ulang agar sinkronisasi dapat dilanjutkan.",
        code: "AUTH_REQUIRED",
      };
    }
    if (status >= 400 && status < 500) {
      return {
        reason: `Permintaan sinkronisasi ditolak server (${status}). Periksa data antrean.`,
        code: "REQUEST_REJECTED",
      };
    }
    if (status >= 500) {
      return {
        reason: `Server bermasalah (${status}). Akan dicoba ulang otomatis.`,
        code: "SERVER_ERROR",
      };
    }
  }

  return {
    reason: "Gagal terhubung ke server. Akan dicoba ulang otomatis.",
    code: "NETWORK_ERROR",
  };
}

function buildAckFailureMeta(reason?: string) {
  if (reason === "PRODUCT_NOT_FOUND") {
    return {
      reason: "Produk tidak ditemukan di server saat replay mutasi.",
      code: "PRODUCT_NOT_FOUND",
    };
  }
  if (reason === "INVALID_PAYLOAD") {
    return {
      reason: "Payload mutasi tidak valid.",
      code: "INVALID_PAYLOAD",
    };
  }
  if (reason === "SCHEMA_ERROR") {
    return {
      reason: "Skema data mutasi tidak sesuai.",
      code: "SCHEMA_ERROR",
    };
  }
  if (reason === "MISSING_USER_ID") {
    return {
      reason: "ID user pada event mutasi tidak tersedia.",
      code: "MISSING_USER_ID",
    };
  }
  return {
    reason: "Mutasi ditolak server dan tidak dapat diproses otomatis.",
    code: reason ?? "REJECTED_BY_SERVER",
  };
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
        await markFailed(row.id, {
          reason: "Melebihi batas percobaan sinkronisasi otomatis.",
          code: "MAX_RETRIES_EXCEEDED",
        });
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
        if (!shouldRetryTransportError(error)) {
          await markFailed(row.id, buildTransportFailureMeta(error));
          continue;
        }
        if (!isRuntimeOnline()) {
          continue;
        }
        await markSendFailed(row.id, buildTransportFailureMeta(error));
        if (row.attemptCount + 1 >= MAX_ATTEMPTS) {
          await markFailed(row.id, {
            reason: "Melebihi batas percobaan sinkronisasi otomatis.",
            code: "MAX_RETRIES_EXCEEDED",
          });
        }
      }
    }

    const rows = await getRetryableInventoryQueue();
    for (const row of rows) {
      if (!row.id) continue;
      if (row.attemptCount >= MAX_ATTEMPTS) {
        await markFailed(row.id, {
          reason: "Melebihi batas percobaan sinkronisasi otomatis.",
          code: "MAX_RETRIES_EXCEEDED",
        });
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
          await markFailed(row.id, buildAckFailureMeta(ack.reason));
          continue;
        }

        await markSendFailed(row.id, {
          reason: "Server belum mengonfirmasi mutasi. Akan dicoba ulang.",
          code: "ACK_MISSING",
        });
        const nextAttempts = row.attemptCount + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          await markFailed(row.id, {
            reason: "Melebihi batas percobaan sinkronisasi otomatis.",
            code: "MAX_RETRIES_EXCEEDED",
          });
        }
      } catch (error) {
        if (!shouldRetryTransportError(error)) {
          await markFailed(row.id, buildTransportFailureMeta(error));
          continue;
        }
        if (!isRuntimeOnline()) {
          continue;
        }

        await markSendFailed(row.id, buildTransportFailureMeta(error));
        const nextAttempts = row.attemptCount + 1;
        if (nextAttempts >= MAX_ATTEMPTS) {
          await markFailed(row.id, {
            reason: "Melebihi batas percobaan sinkronisasi otomatis.",
            code: "MAX_RETRIES_EXCEEDED",
          });
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
