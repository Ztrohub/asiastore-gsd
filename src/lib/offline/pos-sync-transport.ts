import { InventorySyncTransportError } from "@/lib/offline/inventory-sync-transport";

export async function postPosTransactions(transactions: unknown[]) {
  let response: Response;
  try {
    response = await fetch("/api/sync/pos-transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transactions }),
      cache: "no-store",
    });
  } catch {
    throw new InventorySyncTransportError("pos_sync_network_error", { retryable: true });
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new InventorySyncTransportError("pos_sync_rejected", {
        retryable: false,
        status: response.status,
      });
    }
    throw new InventorySyncTransportError("pos_sync_failed", {
      retryable: true,
      status: response.status,
    });
  }

  return (await response.json()) as {
    ok: boolean;
    results: Array<{ id_transaksi: string; status: "acked" | "failed" }>;
  };
}
