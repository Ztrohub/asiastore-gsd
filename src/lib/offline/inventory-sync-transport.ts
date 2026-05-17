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

type SyncResult = { id_queue: string; status: "acked" | "failed"; reason?: string };
type SyncResponse = { ok: boolean; results: SyncResult[] };

export async function postInventoryDeltas(events: InventorySyncEvent[]): Promise<SyncResponse> {
  const response = await fetch("/api/sync/inventory-deltas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("sync_request_failed");
  }
  return (await response.json()) as SyncResponse;
}
