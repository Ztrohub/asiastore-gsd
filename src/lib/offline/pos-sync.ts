"use client";

import { getRetryableQueueByEntity, markAcked, markFailed, markSendFailed } from "@/lib/offline/sync-queue";
import { postPosTransactions } from "@/lib/offline/pos-sync-transport";

export async function runPosSyncPass() {
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
        await markFailed(row.id);
      }
    } catch {
      await markSendFailed(row.id);
    }
  }
}
