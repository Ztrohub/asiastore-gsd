import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db/prisma";
import {
  getProductChangeTime,
  listProducts,
  ProductCatalogConflictError,
  upsertProduct,
} from "@/lib/db/product-catalog";
import { isValidProductMarketplace, normalizeProductMarketplace } from "@/lib/inventory/marketplace";
import {
  assertValidSpecialPriceRules,
  sortSpecialPriceRules,
  type ProductSpecialPriceRecord,
} from "@/lib/pricing/special-price";
import {
  parseProductSyncCursor,
  serializeProductSyncCursor,
} from "@/lib/sync/product-sync-cursor";

type ProductPayload = {
  id_produk?: string;
  nama_produk?: string;
  sku?: string;
  harga_jual?: number;
  harga_jual_unit_besar?: number | null;
  stok_saat_ini?: number;
  stok_unit_besar_saat_ini?: number | null;
  is_active?: boolean;
  is_marketplace?: boolean;
  marketplace_product_name?: string | null;
  marketplace_product_id?: string | null;
  marketplace_sku_id?: string | null;
  unit_small_name?: string;
  unit_large_name?: string | null;
  unit_large_to_small?: number | null;
  allow_buy_in_small?: boolean;
  allow_buy_in_large?: boolean;
  allow_sell_in_small?: boolean;
  allow_sell_in_large?: boolean;
  special_prices?: Array<{
    unit_mutasi?: "SMALL" | "LARGE";
    qty_tenths?: number;
    harga?: number;
  }>;
  updatedAt?: number;
};

async function authorizeSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = decodeSession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true, role: true, passwordVersion: true },
  });
  if (!user || !user.isActive) return null;
  if (user.passwordVersion !== session.passwordVersion || user.role !== session.role) return null;
  return session;
}

function optionalNumber(value: number | null | undefined) {
  return typeof value === "number" ? value : undefined;
}

function optionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeSpecialPricePayload(
  rules: ProductPayload["special_prices"],
): ProductSpecialPriceRecord[] | undefined | null {
  if (rules === undefined) return undefined;
  if (!Array.isArray(rules)) return null;

  const normalized: ProductSpecialPriceRecord[] = [];
  for (const rule of rules) {
    if (rule.unit_mutasi !== "SMALL" && rule.unit_mutasi !== "LARGE") {
      return null;
    }

    normalized.push({
      unit_mutasi: rule.unit_mutasi,
      qty_tenths: Number(rule.qty_tenths),
      harga: Number(rule.harga),
    });
  }

  try {
    assertValidSpecialPriceRules(normalized);
    return sortSpecialPriceRules(normalized);
  } catch {
    return null;
  }
}

function isValidProductPayload(product: ProductPayload) {
  if (!product.nama_produk?.trim()) return false;
  if (!Number.isInteger(product.harga_jual)) return false;
  if ((product.harga_jual ?? 0) < 100 || (product.harga_jual ?? 0) > 999999999) return false;
  const hargaJualUnitBesar = optionalNumber(product.harga_jual_unit_besar);
  if (
    product.harga_jual_unit_besar != null &&
    (hargaJualUnitBesar === undefined ||
      hargaJualUnitBesar < 100 ||
      hargaJualUnitBesar > 999999999)
  ) {
    return false;
  }
  if (!Number.isInteger(product.stok_saat_ini)) return false;
  const stokUnitBesarSaatIni = optionalNumber(product.stok_unit_besar_saat_ini);
  if (
    product.stok_unit_besar_saat_ini != null &&
    stokUnitBesarSaatIni === undefined
  ) {
    return false;
  }
  if (typeof product.is_active !== "boolean") return false;
  if (product.is_marketplace !== undefined && typeof product.is_marketplace !== "boolean") return false;
  if (product.sku && product.sku.length > 64) return false;
  if (!isValidProductMarketplace(product)) return false;

  const smallUnitName = optionalString(product.unit_small_name);
  if (product.unit_small_name !== undefined && !smallUnitName) return false;
  if (smallUnitName && smallUnitName.length > 24) return false;

  const largeUnitName = optionalString(product.unit_large_name);
  if (product.unit_large_name != null && product.unit_large_name.length > 0 && !largeUnitName) return false;
  if (largeUnitName && largeUnitName.length > 24) return false;

  const hasLargeUnit = Boolean(largeUnitName);
  const unitLargeToSmall = optionalNumber(product.unit_large_to_small);
  if (hasLargeUnit) {
    if (unitLargeToSmall === undefined) return false;
    if ((unitLargeToSmall ?? 0) < 2) return false;
  } else if (product.unit_large_to_small != null) {
    return false;
  }

  const boolFields = [
    product.allow_buy_in_small,
    product.allow_buy_in_large,
    product.allow_sell_in_small,
    product.allow_sell_in_large,
  ];
  for (const field of boolFields) {
    if (field !== undefined && typeof field !== "boolean") return false;
  }

  const allowBuyInLarge = Boolean(product.allow_buy_in_large);
  const allowSellInLarge = Boolean(product.allow_sell_in_large);
  const allowBuyInSmall =
    typeof product.allow_buy_in_small === "boolean" ? product.allow_buy_in_small : true;
  const allowSellInSmall =
    typeof product.allow_sell_in_small === "boolean" ? product.allow_sell_in_small : true;

  if (!allowBuyInSmall && !allowBuyInLarge) return false;
  if (!allowSellInSmall && !allowSellInLarge) return false;
  if ((allowBuyInLarge || allowSellInLarge) && !hasLargeUnit) return false;
  if (!hasLargeUnit && hargaJualUnitBesar !== undefined) return false;
  if (normalizeSpecialPricePayload(product.special_prices) === null) return false;

  return true;
}

function parseUpdatedAfter(raw: string | null) {
  if (raw === null || raw.trim() === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseProductCursor(request: NextRequest) {
  const rawCursor = request.nextUrl.searchParams.get("cursor");
  if (rawCursor !== null) {
    const parsedCursor = parseProductSyncCursor(rawCursor);
    return parsedCursor ?? null;
  }

  const updatedAfter = parseUpdatedAfter(request.nextUrl.searchParams.get("updated_after"));
  if (updatedAfter === null) {
    return null;
  }
  return parseProductSyncCursor(updatedAfter);
}

export async function GET(request: NextRequest) {
  const session = await authorizeSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const cursor = parseProductCursor(request);
  if (cursor === null) {
    return NextResponse.json(
      { ok: false, message: "Parameter cursor tidak valid." },
      { status: 400 },
    );
  }

  const products = await listProducts({ cursor: serializeProductSyncCursor(cursor) });
  const nextCursor =
    products.length > 0
      ? serializeProductSyncCursor({
          timestamp: getProductChangeTime(products[products.length - 1]),
          id_produk: products[products.length - 1].id_produk,
        })
      : (serializeProductSyncCursor(cursor) ?? "0");

  const responseProducts = products.map((product) => ({
    ...product,
    updatedAt: new Date(getProductChangeTime(product)),
  }));

  return NextResponse.json({ ok: true, products: responseProducts, cursor: nextCursor });
}

export async function POST(request: NextRequest) {
  const session = await authorizeSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: { products?: ProductPayload[] };
  try {
    body = (await request.json()) as { products?: ProductPayload[] };
  } catch {
    return NextResponse.json({ ok: false, message: "JSON tidak valid." }, { status: 400 });
  }

  const products = body.products;
  if (!products || !Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ ok: false, message: "Products wajib diisi." }, { status: 400 });
  }

  for (const item of products) {
    if (!isValidProductPayload(item)) {
      return NextResponse.json({ ok: false, message: "Payload produk tidak valid." }, { status: 400 });
    }
  }

  try {
    for (const item of products) {
      const marketplaceState = normalizeProductMarketplace(item);
      const specialPrices = normalizeSpecialPricePayload(item.special_prices);
      await upsertProduct({
        id_produk: item.id_produk,
        nama_produk: item.nama_produk!.trim(),
        sku: item.sku?.trim() || undefined,
        harga_jual: item.harga_jual!,
        harga_jual_unit_besar: optionalNumber(item.harga_jual_unit_besar),
        stok_saat_ini: item.stok_saat_ini!,
        stok_unit_besar_saat_ini: optionalNumber(item.stok_unit_besar_saat_ini) ?? 0,
        is_active: item.is_active!,
        is_marketplace: marketplaceState.is_marketplace,
        marketplace_product_name: marketplaceState.marketplace_product_name,
        marketplace_product_id: marketplaceState.marketplace_product_id,
        marketplace_sku_id: marketplaceState.marketplace_sku_id,
        unit_small_name: item.unit_small_name?.trim() || undefined,
        unit_large_name: optionalString(item.unit_large_name),
        unit_large_to_small: optionalNumber(item.unit_large_to_small),
        allow_buy_in_small: item.allow_buy_in_small,
        allow_buy_in_large: item.allow_buy_in_large,
        allow_sell_in_small: item.allow_sell_in_small,
        allow_sell_in_large: item.allow_sell_in_large,
        special_prices: specialPrices ?? undefined,
        updatedAt: item.updatedAt,
      });
    }
  } catch (error) {
    if (error instanceof ProductCatalogConflictError) {
      return NextResponse.json(
        { ok: false, message: `SKU ${error.sku} sudah dipakai produk lain.` },
        { status: 409 },
      );
    }
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("sku")
    ) {
      return NextResponse.json(
        { ok: false, message: "SKU sudah dipakai produk lain." },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true, count: products.length });
}
