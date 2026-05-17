type InventorySyncEvent = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
  id_user?: string;
  jenis_mutasi: "SALES_OUT" | "STOCK_IN" | "STOCK_ADJUSTMENT";
  delta_qty: number;
  logical_clock: number;
  received_seq: number;
  client_timestamp: number;
};

type SyncResult = { id_queue: string; status: "acked" | "failed"; reason?: string };
type SyncResponse = { ok: boolean; results: SyncResult[] };

export class InventorySyncTransportError extends Error {
  readonly retryable: boolean;
  readonly status?: number;

  constructor(message: string, opts?: { retryable: boolean; status?: number }) {
    super(message);
    this.name = "InventorySyncTransportError";
    this.retryable = opts?.retryable ?? true;
    this.status = opts?.status;
  }
}

export async function postInventoryDeltas(events: InventorySyncEvent[]): Promise<SyncResponse> {
  let response: Response;
  try {
    response = await fetch("/api/sync/inventory-deltas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
      cache: "no-store",
    });
  } catch {
    throw new InventorySyncTransportError("sync_network_error", { retryable: true });
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new InventorySyncTransportError("sync_request_rejected", {
        retryable: false,
        status: response.status,
      });
    }
    throw new InventorySyncTransportError("sync_request_failed", {
      retryable: true,
      status: response.status,
    });
  }

  return (await response.json()) as SyncResponse;
}
