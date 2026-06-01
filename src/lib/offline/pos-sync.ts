"use client";

import { getRetryableQueueByEntity, markAcked, markFailed, markSendFailed, reviveFailedQueue } from "@/lib/offline/sync-queue";
import { syncPosTransactionsFromServer } from "@/lib/offline/pos-transaction-history";
import { postPosTransactions } from "@/lib/offline/pos-sync-transport";
import { InventorySyncTransportError } from "@/lib/offline/inventory-sync-transport";

let activePass: Promise<void> | null = null;

function buildPosFailureMeta(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      reason: "Perangkat sedang offline. Menunggu koneksi internet kembali.",
      code: "OFFLINE",
    };
  }

  if (error instanceof InventorySyncTransportError) {
    const status = error.status ?? 0;
    if (status === 401 || status === 403) {
      return {
        reason: "Sesi login tidak valid. Login ulang agar sinkronisasi POS dapat dilanjutkan.",
        code: "AUTH_REQUIRED",
      };
    }
    if (status >= 400 && status < 500) {
      return {
        reason: `Permintaan sinkronisasi POS ditolak server (${status}).`,
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

export async function runPosSyncPass() {
  if (activePass) {
    return activePass;
  }

  activePass = (async () => {
    const rows = await getRetryableQueueByEntity("pos_transaction");
    for (const row of rows) {
      if (!row.id) continue;
      try {
        const payload = JSON.parse(row.deltaPayload);
        const result = await postPosTransactions([payload]);
        const ack = result.results.find((item) => item.id_transaksi === payload.id_transaksi);
        if (ack?.status === "acked") {
          await markAcked(row.id);
        } else {
          const meta = {
            reason: "Server tidak mengonfirmasi transaksi POS.",
            code: "ACK_MISSING",
          };
          await markSendFailed(row.id, meta);
          await markFailed(row.id, meta);
        }
      } catch (error) {
        await markSendFailed(row.id, buildPosFailureMeta(error));
      }
    }
    await syncPosTransactionsFromServer();
  })().finally(() => {
    activePass = null;
  });

  return activePass;
}

export async function retryPosSyncNow() {
  await reviveFailedQueue({
    entityTypes: ["pos_transaction"],
    minAttemptCount: 0,
  });
  await runPosSyncPass();
}
