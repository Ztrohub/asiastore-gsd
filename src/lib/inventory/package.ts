import type { InventoryMutationUnit, ProductRecord } from "@/lib/offline/db";

function getComponentUnitPrice(product: ProductRecord, unit: InventoryMutationUnit) {
  if (unit === "LARGE") {
    return product.harga_jual_unit_besar ?? 0;
  }

  return product.harga_jual;
}

function getComponentUnitStock(product: ProductRecord, unit: InventoryMutationUnit) {
  if (unit === "LARGE") {
    return product.stok_unit_besar_saat_ini ?? 0;
  }

  return product.stok_saat_ini;
}

export function derivePackageCatalogRow(
  pkg: ProductRecord,
  rows: Map<string, ProductRecord>,
): ProductRecord {
  const items = pkg.package_items ?? [];
  if ((pkg.product_kind ?? "NORMAL") !== "PACKAGE" || items.length === 0) {
    return pkg;
  }

  let derivedPrice = 0;
  let derivedStock = Number.POSITIVE_INFINITY;

  for (const item of items) {
    const component = rows.get(item.component_product_id);
    if (!component || (component.product_kind ?? "NORMAL") !== "NORMAL") {
      derivedStock = 0;
      continue;
    }

    derivedPrice += getComponentUnitPrice(component, item.component_unit) * item.component_qty;
    derivedStock = Math.min(
      derivedStock,
      Math.floor(getComponentUnitStock(component, item.component_unit) / item.component_qty),
    );
  }

  return {
    ...pkg,
    harga_jual: derivedPrice,
    stok_saat_ini: Number.isFinite(derivedStock) ? Math.max(0, derivedStock) : 0,
    unit_small_name: "paket",
    unit_large_name: undefined,
    unit_large_to_small: undefined,
    allow_buy_in_small: false,
    allow_buy_in_large: false,
    allow_sell_in_small: true,
    allow_sell_in_large: false,
    stok_unit_besar_saat_ini: 0,
    harga_jual_unit_besar: undefined,
  };
}

export function getPackageMarketplaceListings(pkg: ProductRecord) {
  if ((pkg.product_kind ?? "NORMAL") !== "PACKAGE" || !pkg.marketplace_sku_id) {
    return [];
  }

  return [
    {
      unit: "small" as const,
      marketplace_sku_id: pkg.marketplace_sku_id,
      stock: Math.max(0, pkg.stok_saat_ini),
    },
  ];
}
