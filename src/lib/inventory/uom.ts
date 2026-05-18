import type { ProductRecord } from "@/lib/offline/db";

export type UomMutationUnit = "small" | "large";
export type UomFlow = "purchase" | "sale";

const DEFAULT_SMALL_UNIT = "pcs";

function normalizeUnitName(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
}

function normalizeLargeUnitName(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeLargeFactor(value: number | undefined) {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 2) return null;
  return value;
}

function normalizeFlag(value: boolean | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeProductUom(product: ProductRecord): ProductRecord {
  const smallUnit = normalizeUnitName(product.unit_small_name, DEFAULT_SMALL_UNIT);
  const largeUnit = normalizeLargeUnitName(product.unit_large_name);
  const factor = largeUnit ? normalizeLargeFactor(product.unit_large_to_small) : null;

  let allowBuyLarge = normalizeFlag(product.allow_buy_in_large, false);
  let allowSellLarge = normalizeFlag(product.allow_sell_in_large, false);
  if (!largeUnit || !factor) {
    allowBuyLarge = false;
    allowSellLarge = false;
  }

  const rawAllowBuySmall = normalizeFlag(product.allow_buy_in_small, true);
  const rawAllowSellSmall = normalizeFlag(product.allow_sell_in_small, true);

  const allowBuySmall = rawAllowBuySmall || !allowBuyLarge;
  const allowSellSmall = rawAllowSellSmall || !allowSellLarge;
  const largeSalePrice =
    allowSellLarge && !Number.isInteger(product.harga_jual_unit_besar)
      ? product.harga_jual
      : product.harga_jual_unit_besar;

  return {
    ...product,
    stok_saat_ini: Math.max(0, Math.trunc(product.stok_saat_ini)),
    stok_unit_besar_saat_ini: Math.max(0, Math.trunc(product.stok_unit_besar_saat_ini ?? 0)),
    harga_jual_unit_besar: largeSalePrice,
    unit_small_name: smallUnit,
    unit_large_name: largeUnit,
    unit_large_to_small: factor ?? undefined,
    allow_buy_in_small: allowBuySmall,
    allow_buy_in_large: allowBuyLarge,
    allow_sell_in_small: allowSellSmall,
    allow_sell_in_large: allowSellLarge,
  };
}

export function getSmallUnitName(product: ProductRecord) {
  return normalizeUnitName(normalizeProductUom(product).unit_small_name, DEFAULT_SMALL_UNIT);
}

export function getLargeUnitName(product: ProductRecord) {
  return normalizeUnitName(normalizeProductUom(product).unit_large_name, "");
}

export function getLargeFactor(product: ProductRecord) {
  const normalized = normalizeProductUom(product);
  if (!normalized.unit_large_name) return null;
  return normalizeLargeFactor(normalized.unit_large_to_small);
}

export function allowsSmallUnit(product: ProductRecord, flow: UomFlow) {
  const normalized = normalizeProductUom(product);
  if (flow === "purchase") {
    return Boolean(normalized.allow_buy_in_small);
  }
  return Boolean(normalized.allow_sell_in_small);
}

export function allowsLargeUnit(product: ProductRecord, flow: UomFlow) {
  const normalized = normalizeProductUom(product);
  if (flow === "purchase") {
    return Boolean(normalized.allow_buy_in_large);
  }
  return Boolean(normalized.allow_sell_in_large);
}

export function convertQuantityToSmallUnits(params: {
  product: ProductRecord;
  quantity: number;
  unit: UomMutationUnit;
  flow: UomFlow;
}) {
  if (!Number.isInteger(params.quantity) || params.quantity <= 0) {
    throw new Error("Qty harus bilangan bulat positif.");
  }

  if (params.unit === "small") {
    if (!allowsSmallUnit(params.product, params.flow)) {
      throw new Error("Unit kecil tidak diizinkan untuk transaksi ini.");
    }
    return params.quantity;
  }

  const factor = getLargeFactor(params.product);
  if (!factor) {
    throw new Error("Konversi unit besar belum diatur pada produk.");
  }
  if (!allowsLargeUnit(params.product, params.flow)) {
    throw new Error("Unit besar tidak diizinkan untuk transaksi ini.");
  }

  return params.quantity * factor;
}

export function describeStockBreakdown(product: ProductRecord) {
  const normalized = normalizeProductUom(product);
  const smallUnitName = getSmallUnitName(normalized);
  const largeUnitName = getLargeUnitName(normalized);
  const factor = getLargeFactor(normalized);

  if (!largeUnitName || !factor) {
    return null;
  }

  const totalSmall = Math.max(0, Math.trunc(normalized.stok_saat_ini));
  const fullLarge = Math.floor(totalSmall / factor);
  const remainderSmall = totalSmall % factor;

  return {
    fullLarge,
    remainderSmall,
    largeUnitName,
    smallUnitName,
  };
}

