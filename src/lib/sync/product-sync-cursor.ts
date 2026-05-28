export type ProductSyncCursor = {
  timestamp: number;
  id_produk: string;
};

function normalizeTimestamp(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.trunc(value);
}

export function parseProductSyncCursor(value: unknown): ProductSyncCursor | undefined {
  if (typeof value === "number") {
    const timestamp = normalizeTimestamp(value);
    if (timestamp === undefined) return undefined;
    return { timestamp, id_produk: "" };
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  const [timestampRaw, ...idParts] = normalized.split(":");
  const timestamp = normalizeTimestamp(Number(timestampRaw));
  if (timestamp === undefined) {
    return undefined;
  }

  return {
    timestamp,
    id_produk: idParts.join(":").trim(),
  };
}

export function serializeProductSyncCursor(cursor: ProductSyncCursor | undefined) {
  if (!cursor) return undefined;
  return cursor.id_produk
    ? `${cursor.timestamp}:${cursor.id_produk}`
    : String(cursor.timestamp);
}

export function compareProductSyncCursor(
  left: ProductSyncCursor | undefined,
  right: ProductSyncCursor | undefined,
) {
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  if (left.timestamp !== right.timestamp) {
    return left.timestamp - right.timestamp;
  }
  return left.id_produk.localeCompare(right.id_produk);
}

export function maxProductSyncCursor(
  left: ProductSyncCursor | undefined,
  right: ProductSyncCursor | undefined,
) {
  return compareProductSyncCursor(left, right) >= 0 ? left : right;
}

export function isProductAfterCursor(
  changeTimestamp: number,
  productId: string,
  cursor: ProductSyncCursor | undefined,
) {
  if (!cursor) return true;
  if (changeTimestamp > cursor.timestamp) return true;
  if (changeTimestamp < cursor.timestamp) return false;
  if (!cursor.id_produk) return false;
  return productId.localeCompare(cursor.id_produk) > 0;
}

export function buildProductCursorQuery(cursor?: string) {
  if (!cursor) {
    return "/api/inventory/products";
  }
  return `/api/inventory/products?cursor=${encodeURIComponent(cursor)}`;
}
