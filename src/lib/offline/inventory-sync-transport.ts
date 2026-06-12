import type { ProductSpecialPriceRecord } from "@/lib/pricing/special-price";

type InventorySyncEvent = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
  id_user?: string;
  jenis_mutasi: "SALES_OUT" | "STOCK_IN" | "STOCK_ADJUSTMENT";
  unit_mutasi?: "SMALL" | "LARGE";
  delta_qty: number;
  logical_clock: number;
  received_seq: number;
  client_timestamp: number;
};

type SyncResult = { id_queue: string; status: "acked" | "failed"; reason?: string };
type SyncResponse = { ok: boolean; results: SyncResult[] };
type ProductSyncRecord = {
  id_produk: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  stok_saat_ini: number;
  harga_jual_unit_besar?: number;
  stok_unit_besar_saat_ini?: number;
  is_active: boolean;
  is_marketplace?: boolean;
  marketplace_product_name?: string;
  marketplace_product_id?: string;
  marketplace_sku_id?: string;
  unit_small_name?: string;
  unit_large_name?: string;
  unit_large_to_small?: number;
  allow_buy_in_small?: boolean;
  allow_buy_in_large?: boolean;
  allow_sell_in_small?: boolean;
  allow_sell_in_large?: boolean;
  special_prices?: ProductSpecialPriceRecord[];
  updatedAt: number;
};

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

export async function postProductUpserts(products: ProductSyncRecord[]) {
  let response: Response;
  try {
    response = await fetch("/api/inventory/products", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ products }),
      cache: "no-store",
    });
  } catch {
    throw new InventorySyncTransportError("product_sync_network_error", { retryable: true });
  }

  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new InventorySyncTransportError("product_sync_request_rejected", {
        retryable: false,
        status: response.status,
      });
    }
    throw new InventorySyncTransportError("product_sync_request_failed", {
      retryable: true,
      status: response.status,
    });
  }

  return (await response.json()) as { ok: boolean; count: number };
}
