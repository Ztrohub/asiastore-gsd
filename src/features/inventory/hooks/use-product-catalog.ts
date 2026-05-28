"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { offlineDb, type ProductRecord, type SyncQueueRecord } from "@/lib/offline/db";
import { enqueueDelta, markAcked } from "@/lib/offline/sync-queue";
import { normalizeProductUom } from "@/lib/inventory/uom";
import { postProductUpserts } from "@/lib/offline/inventory-sync-transport";
import {
  buildProductCursorQuery,
  maxProductSyncCursor,
  parseProductSyncCursor,
  serializeProductSyncCursor,
} from "@/lib/sync/product-sync-cursor";

type ProductInput = {
  id_produk?: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  harga_jual_unit_besar?: number;
  stok_saat_ini?: number;
  stok_unit_besar_saat_ini?: number;
  is_active?: boolean;
  unit_small_name?: string;
  unit_large_name?: string;
  unit_large_to_small?: number;
  allow_buy_in_small?: boolean;
  allow_buy_in_large?: boolean;
  allow_sell_in_small?: boolean;
  allow_sell_in_large?: boolean;
};

const PRODUCT_SYNC_CURSOR_KEY = "inventory_products_last_sync_cursor";
const PRODUCT_CATALOG_POLL_MS = 30_000;
const PRODUCT_SYNC_CURSOR_FUTURE_TOLERANCE_MS = 5 * 60 * 1_000;

async function getProductSyncCursor() {
  const cursorMeta = await offlineDb.appMeta.get(PRODUCT_SYNC_CURSOR_KEY);
  const parsed = parseProductSyncCursor(cursorMeta?.value);
  if (!parsed) {
    return undefined;
  }
  if (parsed.timestamp > Date.now() + PRODUCT_SYNC_CURSOR_FUTURE_TOLERANCE_MS) {
    return undefined;
  }
  return serializeProductSyncCursor(parsed);
}

async function setProductSyncCursor(cursor: string) {
  const current = parseProductSyncCursor(await getProductSyncCursor());
  const incoming = parseProductSyncCursor(cursor);
  if (!incoming) {
    return current ? serializeProductSyncCursor(current) : undefined;
  }
  const nextCursor = serializeProductSyncCursor(maxProductSyncCursor(current, incoming));
  if (!nextCursor) {
    return undefined;
  }

  await offlineDb.appMeta.put({
    key: PRODUCT_SYNC_CURSOR_KEY,
    value: nextCursor,
  });

  return nextCursor;
}

function resolveCursor(value: unknown, fallback: string | undefined) {
  const parsed = parseProductSyncCursor(value);
  if (parsed) {
    return serializeProductSyncCursor(parsed);
  }
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return String(Math.trunc(value));
  }
  return fallback;
}

export function normalizeUpdatedAt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

function parseUpdatedAtForCursor(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

function validatePrice(harga: number) {
  if (!Number.isInteger(harga)) {
    throw new Error("Harga jual harus bilangan bulat.");
  }
  if (harga < 100 || harga > 999999999) {
    throw new Error("Harga jual harus antara 100 dan 999999999.");
  }
}

function validateOptionalPrice(harga: number | undefined) {
  if (harga === undefined) return;
  validatePrice(harga);
}

function optionalNumber(value: number | null | undefined) {
  return typeof value === "number" ? value : undefined;
}

function optionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

async function queueProductSync(product: ProductRecord) {
  return enqueueDelta({
    entityType: "inventory_product",
    entityId: product.id_produk,
    deltaPayload: JSON.stringify(product),
    allowNegativeStock: true,
  });
}

function isRuntimeOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function getPendingLocalProductLocks(queueRows: SyncQueueRecord[]) {
  const pendingProductIds = new Set<string>();
  const pendingMutationProductIds = new Set<string>();

  for (const row of queueRows) {
    const hasBlockingLocalSync = row.status === "pending" || row.status === "sent";
    if (!hasBlockingLocalSync) continue;
    if (row.entityType === "inventory_product") {
      pendingProductIds.add(row.entityId);
      continue;
    }
    if (row.entityType !== "inventory_mutation") {
      continue;
    }
    try {
      const payload = JSON.parse(row.deltaPayload) as { id_produk?: string };
      if (payload.id_produk) {
        pendingMutationProductIds.add(payload.id_produk);
      }
    } catch {
      // Ignore malformed payload and keep best-effort server merge behavior.
    }
  }

  return { pendingProductIds, pendingMutationProductIds };
}

export async function persistProductCatalog(input: ProductInput) {
  validatePrice(input.harga_jual);
  validateOptionalPrice(input.harga_jual_unit_besar);
  const now = Date.now();
  const existing =
    input.id_produk ? await offlineDb.products.get(input.id_produk) : undefined;
  const product: ProductRecord = normalizeProductUom({
    ...(existing ?? {
      id_produk: input.id_produk ?? crypto.randomUUID(),
      nama_produk: "",
      harga_jual: input.harga_jual,
      stok_saat_ini: 0,
      is_active: true,
      updatedAt: now,
    }),
    nama_produk: input.nama_produk.trim(),
    sku:
      input.sku === undefined ? existing?.sku : input.sku.trim() || undefined,
    harga_jual: input.harga_jual,
    harga_jual_unit_besar:
      input.harga_jual_unit_besar ?? optionalNumber(existing?.harga_jual_unit_besar),
    stok_saat_ini: Math.max(0, Math.trunc(input.stok_saat_ini ?? existing?.stok_saat_ini ?? 0)),
    stok_unit_besar_saat_ini: Math.max(
      0,
      Math.trunc(input.stok_unit_besar_saat_ini ?? existing?.stok_unit_besar_saat_ini ?? 0),
    ),
    is_active: input.is_active ?? existing?.is_active ?? true,
    unit_small_name: input.unit_small_name ?? existing?.unit_small_name,
    unit_large_name: input.unit_large_name ?? optionalString(existing?.unit_large_name),
    unit_large_to_small:
      input.unit_large_to_small ?? optionalNumber(existing?.unit_large_to_small),
    allow_buy_in_small:
      input.allow_buy_in_small ?? existing?.allow_buy_in_small,
    allow_buy_in_large:
      input.allow_buy_in_large ?? existing?.allow_buy_in_large,
    allow_sell_in_small:
      input.allow_sell_in_small ?? existing?.allow_sell_in_small,
    allow_sell_in_large:
      input.allow_sell_in_large ?? existing?.allow_sell_in_large,
    updatedAt: now,
  });
  await offlineDb.products.put(product);
  const queueId = await queueProductSync(product);

  if (isRuntimeOnline()) {
    try {
      await postProductUpserts([product]);
      await markAcked(queueId);
    } catch {
      // Keep queue pending for retry loop.
    }
  }

  return product;
}

export function useProductCatalog() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncPassRef = useRef<Promise<void> | null>(null);

  const refreshLocal = useCallback(async () => {
    const rows = await offlineDb.products.orderBy("nama_produk").toArray();
    setProducts(rows.filter((item) => item.is_active).map(normalizeProductUom));
  }, []);

  const syncFromServer = useCallback(async () => {
    if (syncPassRef.current) {
      return syncPassRef.current;
    }

    syncPassRef.current = (async () => {
      try {
        const lastCursor = await getProductSyncCursor();
        const url = buildProductCursorQuery(lastCursor);
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          ok: boolean;
          cursor?: unknown;
          products?: Array<ProductRecord & { updatedAt?: unknown }>;
        };
        const serverProducts = payload.products;
        if (!payload.ok || !serverProducts) return;
        const serverUpdatedAts = serverProducts
          .map((product) => parseUpdatedAtForCursor(product.updatedAt))
          .filter((value): value is number => typeof value === "number");
        const maxFromRows =
          serverUpdatedAts.length > 0 ? Math.max(...serverUpdatedAts) : undefined;
        const nextCursor =
          resolveCursor(payload.cursor, maxFromRows ? String(maxFromRows) : lastCursor) ??
          (maxFromRows ? String(maxFromRows) : undefined) ??
          lastCursor;
        const queueRows = await offlineDb.syncQueue
          .where("entityType")
          .anyOf("inventory_product", "inventory_mutation")
          .toArray();
        const unresolvedLocalDeltas = queueRows.filter(
          (row) => row.status === "pending" || row.status === "sent",
        ).length;
        const { pendingProductIds, pendingMutationProductIds } =
          getPendingLocalProductLocks(queueRows);

        await offlineDb.transaction("rw", offlineDb.products, async () => {
          for (const product of serverProducts) {
            const hasLocalPendingChanges =
              pendingProductIds.has(product.id_produk) ||
              pendingMutationProductIds.has(product.id_produk);
            if (unresolvedLocalDeltas > 0 && hasLocalPendingChanges) {
              continue;
            }
            await offlineDb.products.put({
              ...normalizeProductUom(product),
              updatedAt: normalizeUpdatedAt(product.updatedAt),
            });
          }
        });
        if (typeof nextCursor === "string") {
          await setProductSyncCursor(nextCursor);
        }
        await refreshLocal();
      } catch {
        // Best-effort sync; local cache remains the source for offline continuity.
      }
    })().finally(() => {
      syncPassRef.current = null;
    });

    return syncPassRef.current;
  }, [refreshLocal]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshLocal();
        if (mounted) setLoading(false);
        if (navigator.onLine) {
          await syncFromServer();
        }
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Gagal memuat katalog produk.";
        setError(message);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshLocal, syncFromServer]);

  useEffect(() => {
    const syncOnReconnect = () => {
      syncFromServer().catch(() => undefined);
    };

    window.addEventListener("online", syncOnReconnect);
    return () => {
      window.removeEventListener("online", syncOnReconnect);
    };
  }, [syncFromServer]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!navigator.onLine) {
        return;
      }
      syncFromServer().catch(() => undefined);
    }, PRODUCT_CATALOG_POLL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [syncFromServer]);

  const saveProduct = useCallback(
    async (input: ProductInput) => {
      const product = await persistProductCatalog(input);
      await refreshLocal();
      return product;
    },
    [refreshLocal],
  );

  return { products, loading, error, saveProduct, refreshLocal, syncFromServer };
}
