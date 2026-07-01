import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { toDatabaseProductMarketplace } from "@/lib/inventory/marketplace";
import {
  assertValidSpecialPriceRules,
  sortSpecialPriceRules,
  type ProductSpecialPriceRecord,
} from "@/lib/pricing/special-price";
import {
  isProductAfterCursor,
  parseProductSyncCursor,
} from "@/lib/sync/product-sync-cursor";

type ProductKind = "NORMAL" | "PACKAGE";

type PackageItemInput = {
  component_product_id: string;
  component_unit: "SMALL" | "LARGE";
  component_qty: number;
};

export type ProductUpsertInput = {
  id_produk?: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  harga_jual_unit_besar?: number;
  stok_saat_ini: number;
  stok_unit_besar_saat_ini?: number;
  is_active: boolean;
  product_kind?: ProductKind;
  package_items?: PackageItemInput[];
  is_marketplace?: boolean;
  marketplace_product_name?: string;
  marketplace_product_id?: string;
  marketplace_sku_id?: string;
  marketplace_large_product_id?: string;
  marketplace_large_sku_id?: string;
  unit_small_name?: string;
  unit_large_name?: string;
  unit_large_to_small?: number;
  allow_buy_in_small?: boolean;
  allow_buy_in_large?: boolean;
  allow_sell_in_small?: boolean;
  allow_sell_in_large?: boolean;
  special_prices?: ProductSpecialPriceRecord[];
  updatedAt?: number;
};

export type ProductListParams = {
  updatedAfterMs?: number;
  cursor?: string;
};

type ProductChangeTimestamps = {
  createdAt: Date;
  updatedAt: Date;
  last_synced_at: Date | null;
};

type ProductCatalogDbClient = Pick<
  typeof prisma,
  "product" | "productSpecialPrice" | "productPackageItem"
>;

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

export class ProductCatalogValidationError extends Error {
  readonly code = "PRODUCT_VALIDATION";

  constructor(message: string) {
    super(message);
    this.name = "ProductCatalogValidationError";
  }
}

function normalizeSku(sku: string | undefined) {
  const value = sku?.trim();
  return value ? value : undefined;
}

const DEFAULT_SMALL_UNIT = "pcs";
const DEFAULT_PACKAGE_UNIT = "paket";

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

function normalizeProductKind(value: ProductKind | undefined): ProductKind {
  return value === "PACKAGE" ? "PACKAGE" : "NORMAL";
}

function normalizePackageItems(items: PackageItemInput[] | undefined) {
  if (items === undefined) {
    return undefined;
  }

  const normalized: PackageItemInput[] = [];
  for (const item of items) {
    const componentProductId = item.component_product_id?.trim();
    if (!componentProductId) {
      throw new ProductCatalogValidationError("ID produk komponen wajib diisi.");
    }
    if (item.component_unit !== "SMALL" && item.component_unit !== "LARGE") {
      throw new ProductCatalogValidationError("Unit komponen paket tidak valid.");
    }
    if (!Number.isFinite(item.component_qty) || item.component_qty <= 0) {
      throw new ProductCatalogValidationError("Qty komponen paket harus lebih dari 0.");
    }

    normalized.push({
      component_product_id: componentProductId,
      component_unit: item.component_unit,
      component_qty: item.component_qty,
    });
  }

  return normalized;
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

function filterRulesByEnabledUnits(
  rules: ProductSpecialPriceRecord[],
  flags: { allowSmall: boolean; allowLarge: boolean },
) {
  return rules.filter((rule) =>
    rule.unit_mutasi === "SMALL" ? flags.allowSmall : flags.allowLarge,
  );
}

function normalizeSpecialPriceRules(
  input: ProductSpecialPriceRecord[] | undefined,
  flags: { allowSmall: boolean; allowLarge: boolean },
) {
  if (input === undefined) {
    return undefined;
  }

  const normalizedRules = sortSpecialPriceRules(filterRulesByEnabledUnits(input, flags));
  assertValidSpecialPriceRules(normalizedRules);
  return normalizedRules;
}

function isStaleUpdate(updatedAt: number | undefined, lastSyncedAt: Date | null) {
  return Boolean(lastSyncedAt && updatedAt && updatedAt < lastSyncedAt.getTime());
}

const productInclude: Prisma.ProductInclude = {
  special_prices: {
    orderBy: [{ unit_mutasi: "asc" }, { qty_tenths: "desc" }],
  },
  package_items: {
    select: {
      component_product_id: true,
      component_unit: true,
      component_qty: true,
    },
    orderBy: [{ component_product_id: "asc" }, { component_unit: "asc" }],
  },
};

const existingMarketplaceSelect = {
  id_produk: true,
  last_synced_at: true,
  product_kind: true,
  is_marketplace: true,
  marketplace_product_name: true,
  marketplace_product_id: true,
  marketplace_sku_id: true,
  marketplace_large_product_id: true,
  marketplace_large_sku_id: true,
} as const;

export function getProductChangeTime(product: ProductChangeTimestamps) {
  return Math.max(
    product.createdAt.getTime(),
    product.updatedAt.getTime(),
    product.last_synced_at?.getTime() ?? 0,
  );
}

async function loadProductWithSpecialPrices(db: ProductCatalogDbClient, id_produk: string) {
  return db.product.findUnique({
    where: { id_produk },
    include: productInclude,
  });
}

async function syncProductSpecialPrices(
  db: ProductCatalogDbClient,
  id_produk: string,
  rules: ProductSpecialPriceRecord[] | undefined,
) {
  if (rules !== undefined) {
    await db.productSpecialPrice.deleteMany({ where: { id_produk } });

    if (rules.length > 0) {
      await db.productSpecialPrice.createMany({
        data: rules.map((rule) => ({
          id_produk,
          unit_mutasi: rule.unit_mutasi,
          qty_tenths: rule.qty_tenths,
          harga: rule.harga,
        })),
      });
    }
  }

  return loadProductWithSpecialPrices(db, id_produk);
}

async function syncProductPackageItems(
  db: ProductCatalogDbClient,
  id_produk: string,
  productKind: ProductKind,
  packageItems: PackageItemInput[] | undefined,
) {
  if (productKind === "PACKAGE") {
    if (!packageItems || packageItems.length === 0) {
      throw new ProductCatalogValidationError("Produk paket harus memiliki komponen.");
    }
    if (packageItems.some((item) => item.component_product_id === id_produk)) {
      throw new ProductCatalogValidationError("Produk paket tidak boleh berisi dirinya sendiri.");
    }
  }

  await db.productPackageItem.deleteMany({
    where: { package_product_id: id_produk },
  });

  if (productKind !== "PACKAGE" || !packageItems?.length) {
    return;
  }

  await db.productPackageItem.createMany({
    data: packageItems.map((item) => ({
      package_product_id: id_produk,
      component_product_id: item.component_product_id,
      component_unit: item.component_unit,
      component_qty: item.component_qty,
    })),
  });
}

export async function listProducts(params?: ProductListParams) {
  const parsedCursor = parseProductSyncCursor(params?.cursor ?? params?.updatedAfterMs);

  const products = await prisma.product.findMany({
    where: parsedCursor
      ? {
          OR: [
            { createdAt: { gte: new Date(parsedCursor.timestamp) } },
            { updatedAt: { gte: new Date(parsedCursor.timestamp) } },
            { last_synced_at: { gte: new Date(parsedCursor.timestamp) } },
          ],
        }
      : undefined,
    include: productInclude,
    orderBy: [{ updatedAt: "asc" }, { id_produk: "asc" }],
  });

  const sorted = products.sort((a, b) => {
    const byChangeTime = getProductChangeTime(a) - getProductChangeTime(b);
    if (byChangeTime !== 0) return byChangeTime;
    return a.id_produk.localeCompare(b.id_produk);
  });

  if (!parsedCursor) {
    return sorted;
  }

  return sorted.filter((product) =>
    isProductAfterCursor(getProductChangeTime(product), product.id_produk, parsedCursor),
  );
}

export async function upsertProduct(input: ProductUpsertInput) {
  const incomingSyncedAt = input.updatedAt ? new Date(input.updatedAt) : new Date();
  const normalizedSku = normalizeSku(input.sku);
  const idProduk = input.id_produk;
  const normalizedProductKind = normalizeProductKind(input.product_kind);
  const normalizedPackageItems = normalizePackageItems(input.package_items);
  const normalizedUom =
    normalizedProductKind === "PACKAGE"
      ? {
          unit_small_name: normalizeUnitName(input.unit_small_name, DEFAULT_PACKAGE_UNIT),
          unit_large_name: null,
          unit_large_to_small: null,
          allow_buy_in_small: false,
          allow_buy_in_large: false,
          allow_sell_in_small: true,
          allow_sell_in_large: false,
        }
      : normalizeUomInput(input);
  const normalizedRules = normalizeSpecialPriceRules(input.special_prices, {
    allowSmall: normalizedUom.allow_sell_in_small,
    allowLarge: normalizedUom.allow_sell_in_large,
  });
  const largeSalePrice =
    normalizedUom.allow_sell_in_large && !Number.isInteger(input.harga_jual_unit_besar)
      ? input.harga_jual
      : input.harga_jual_unit_besar;

  const basePayload = {
    nama_produk: input.nama_produk,
    sku: normalizedSku ?? null,
    harga_jual: input.harga_jual,
    harga_jual_unit_besar: largeSalePrice ?? null,
    stok_saat_ini: input.stok_saat_ini,
    stok_unit_besar_saat_ini: input.stok_unit_besar_saat_ini ?? 0,
    is_active: input.is_active,
    product_kind: normalizedProductKind,
    ...normalizedUom,
  };

  return prisma.$transaction(async (trx) => {
    if (idProduk) {
      const existingById = await trx.product.findUnique({
        where: { id_produk: idProduk },
        select: existingMarketplaceSelect,
      });

      let targetId = idProduk;
      let marketplaceFallback = existingById;
      if (isStaleUpdate(input.updatedAt, existingById?.last_synced_at ?? null)) {
        return loadProductWithSpecialPrices(trx, idProduk);
      }

      if (normalizedSku) {
        const existingBySku = await trx.product.findUnique({
          where: { sku: normalizedSku },
          select: existingMarketplaceSelect,
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
            marketplaceFallback = existingBySku;
            if (isStaleUpdate(input.updatedAt, existingBySku.last_synced_at)) {
              return loadProductWithSpecialPrices(trx, targetId);
            }
          }
        }
      }

      const payload = {
        ...basePayload,
        ...toDatabaseProductMarketplace(input, marketplaceFallback),
        last_synced_at: incomingSyncedAt,
      };

      const product = await trx.product.upsert({
        where: { id_produk: targetId },
        update: payload,
        create: {
          id_produk: targetId,
          ...payload,
        },
      });

      await syncProductPackageItems(
        trx,
        product.id_produk,
        normalizedProductKind,
        normalizedPackageItems,
      );
      return syncProductSpecialPrices(trx, product.id_produk, normalizedRules);
    }

    if (normalizedSku) {
      const existingBySku = await trx.product.findUnique({
        where: { sku: normalizedSku },
        select: existingMarketplaceSelect,
      });

      if (existingBySku) {
        if (isStaleUpdate(input.updatedAt, existingBySku.last_synced_at)) {
          return loadProductWithSpecialPrices(trx, existingBySku.id_produk);
        }

        const payload = {
          ...basePayload,
          ...toDatabaseProductMarketplace(input, existingBySku),
          last_synced_at: incomingSyncedAt,
        };
        const product = await trx.product.update({
          where: { id_produk: existingBySku.id_produk },
          data: payload,
        });

        await syncProductPackageItems(
          trx,
          product.id_produk,
          normalizedProductKind,
          normalizedPackageItems,
        );
        return syncProductSpecialPrices(trx, product.id_produk, normalizedRules);
      }
    }

    const payload = {
      ...basePayload,
      ...toDatabaseProductMarketplace(input),
      last_synced_at: incomingSyncedAt,
    };

    const product = await trx.product.create({
      data: payload,
    });

    await syncProductPackageItems(
      trx,
      product.id_produk,
      normalizedProductKind,
      normalizedPackageItems,
    );
    return syncProductSpecialPrices(trx, product.id_produk, normalizedRules);
  });
}
