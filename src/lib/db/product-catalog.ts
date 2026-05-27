import { prisma } from "@/lib/db/prisma";

export type ProductUpsertInput = {
  id_produk?: string;
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
  updatedAt?: number;
};

export type ProductListParams = {
  updatedAfterMs?: number;
};

type ProductChangeTimestamps = {
  createdAt: Date;
  updatedAt: Date;
  last_synced_at: Date | null;
};

export class ProductCatalogConflictError extends Error {
  readonly code = "SKU_CONFLICT";
  readonly sku: string;
  readonly conflictingProductId: string;

  constructor(params: { sku: string; conflictingProductId: string }) {
    super(`SKU ${params.sku} sudah dipakai produk lain.`);
    this.name = "ProductCatalogConflictError";
    this.sku = params.sku;
    this.conflictingProductId = params.conflictingProductId;
  }
}

function normalizeSku(sku: string | undefined) {
  const value = sku?.trim();
  return value ? value : undefined;
}

const DEFAULT_SMALL_UNIT = "pcs";

function normalizeUnitName(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function normalizeLargeUnitName(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeLargeFactor(value: number | undefined) {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 2) return null;
  return value;
}

function normalizeFlag(value: boolean | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeUomInput(input: ProductUpsertInput) {
  const unitSmallName = normalizeUnitName(input.unit_small_name, DEFAULT_SMALL_UNIT);
  const unitLargeName = normalizeLargeUnitName(input.unit_large_name);
  const unitLargeToSmall = unitLargeName ? normalizeLargeFactor(input.unit_large_to_small) : null;

  let allowBuyInLarge = normalizeFlag(input.allow_buy_in_large, false);
  let allowSellInLarge = normalizeFlag(input.allow_sell_in_large, false);
  if (!unitLargeName || !unitLargeToSmall) {
    allowBuyInLarge = false;
    allowSellInLarge = false;
  }

  const allowBuyInSmall = normalizeFlag(input.allow_buy_in_small, true) || !allowBuyInLarge;
  const allowSellInSmall = normalizeFlag(input.allow_sell_in_small, true) || !allowSellInLarge;

  return {
    unit_small_name: unitSmallName,
    unit_large_name: unitLargeName,
    unit_large_to_small: unitLargeToSmall,
    allow_buy_in_small: allowBuyInSmall,
    allow_buy_in_large: allowBuyInLarge,
    allow_sell_in_small: allowSellInSmall,
    allow_sell_in_large: allowSellInLarge,
  };
}

function isStaleUpdate(updatedAt: number | undefined, lastSyncedAt: Date | null) {
  return Boolean(lastSyncedAt && updatedAt && updatedAt < lastSyncedAt.getTime());
}

export function getProductChangeTime(product: ProductChangeTimestamps) {
  return Math.max(
    product.createdAt.getTime(),
    product.updatedAt.getTime(),
    product.last_synced_at?.getTime() ?? 0,
  );
}

export async function listProducts(params?: ProductListParams) {
  const updatedAfterMs = params?.updatedAfterMs;
  const hasUpdatedAfter = Number.isFinite(updatedAfterMs);

  const products = await prisma.product.findMany({
    where: hasUpdatedAfter
      ? {
          OR: [
            { createdAt: { gt: new Date(updatedAfterMs!) } },
            { updatedAt: { gt: new Date(updatedAfterMs!) } },
            { last_synced_at: { gt: new Date(updatedAfterMs!) } },
          ],
        }
      : undefined,
    orderBy: [{ updatedAt: "asc" }, { nama_produk: "asc" }],
  });

  return products.sort((a, b) => {
    const byChangeTime = getProductChangeTime(a) - getProductChangeTime(b);
    if (byChangeTime !== 0) return byChangeTime;
    return a.nama_produk.localeCompare(b.nama_produk);
  });
}

export async function upsertProduct(input: ProductUpsertInput) {
  const incomingSyncedAt = input.updatedAt ? new Date(input.updatedAt) : new Date();
  const normalizedSku = normalizeSku(input.sku);
  const idProduk = input.id_produk;
  const normalizedUom = normalizeUomInput(input);
  const largeSalePrice =
    normalizedUom.allow_sell_in_large && !Number.isInteger(input.harga_jual_unit_besar)
      ? input.harga_jual
      : input.harga_jual_unit_besar;

  const payload = {
    nama_produk: input.nama_produk,
    sku: normalizedSku ?? null,
    harga_jual: input.harga_jual,
    harga_jual_unit_besar: largeSalePrice ?? null,
    stok_saat_ini: input.stok_saat_ini,
    stok_unit_besar_saat_ini: input.stok_unit_besar_saat_ini ?? 0,
    is_active: input.is_active,
    ...normalizedUom,
    last_synced_at: incomingSyncedAt,
  };

  if (idProduk) {
    const existingById = await prisma.product.findUnique({
      where: { id_produk: idProduk },
      select: { id_produk: true, last_synced_at: true },
    });

    let targetId = idProduk;
    if (isStaleUpdate(input.updatedAt, existingById?.last_synced_at ?? null)) {
      return prisma.product.findUnique({ where: { id_produk: idProduk } });
    }

    if (normalizedSku) {
      const existingBySku = await prisma.product.findUnique({
        where: { sku: normalizedSku },
        select: { id_produk: true, last_synced_at: true },
      });

      if (existingBySku) {
        if (existingById && existingBySku.id_produk !== idProduk) {
          throw new ProductCatalogConflictError({
            sku: normalizedSku,
            conflictingProductId: existingBySku.id_produk,
          });
        }

        if (!existingById) {
          targetId = existingBySku.id_produk;
          if (isStaleUpdate(input.updatedAt, existingBySku.last_synced_at)) {
            return prisma.product.findUnique({ where: { id_produk: targetId } });
          }
        }
      }
    }

    return prisma.product.upsert({
      where: { id_produk: targetId },
      update: payload,
      create: {
        id_produk: targetId,
        ...payload,
      },
    });
  }

  if (normalizedSku) {
    const existingBySku = await prisma.product.findUnique({
      where: { sku: normalizedSku },
      select: { id_produk: true, last_synced_at: true },
    });

    if (existingBySku) {
      if (isStaleUpdate(input.updatedAt, existingBySku.last_synced_at)) {
        return prisma.product.findUnique({ where: { id_produk: existingBySku.id_produk } });
      }
      return prisma.product.update({
        where: { id_produk: existingBySku.id_produk },
        data: payload,
      });
    }
  }

  return prisma.product.create({
    data: payload,
  });
}

