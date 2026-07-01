import { describe, expect, it } from "vitest";
import {
  derivePackageCatalogRow,
  getPackageMarketplaceListings,
} from "@/lib/inventory/package";

describe("package product derivation", () => {
  it("derives package stock from the limiting component across small and large units", () => {
    const rows = new Map([
      [
        "prod-a",
        {
          id_produk: "prod-a",
          nama_produk: "Produk A",
          harga_jual: 10000,
          stok_saat_ini: 8,
          is_active: true,
          product_kind: "NORMAL" as const,
          unit_small_name: "pcs",
          allow_sell_in_small: true,
          updatedAt: 1782896400000,
        },
      ],
      [
        "prod-b",
        {
          id_produk: "prod-b",
          nama_produk: "Produk B",
          harga_jual: 12000,
          stok_saat_ini: 8,
          is_active: true,
          product_kind: "NORMAL" as const,
          unit_small_name: "pcs",
          allow_sell_in_small: true,
          updatedAt: 1782896400000,
        },
      ],
      [
        "prod-c",
        {
          id_produk: "prod-c",
          nama_produk: "Produk C",
          harga_jual: 9000,
          harga_jual_unit_besar: 45000,
          stok_saat_ini: 20,
          stok_unit_besar_saat_ini: 5,
          is_active: true,
          product_kind: "NORMAL" as const,
          unit_small_name: "pcs",
          unit_large_name: "dus",
          unit_large_to_small: 5,
          allow_sell_in_small: true,
          allow_sell_in_large: true,
          updatedAt: 1782896400000,
        },
      ],
    ]);

    const pkg = derivePackageCatalogRow(
      {
        id_produk: "pkg-1",
        nama_produk: "Paket A",
        sku: "PKT-A",
        harga_jual: 0,
        stok_saat_ini: 0,
        is_active: true,
        is_marketplace: true,
        marketplace_product_name: "Paket A Marketplace",
        marketplace_sku_id: "SKU-PKT-A",
        product_kind: "PACKAGE" as const,
        package_items: [
          { component_product_id: "prod-a", component_unit: "SMALL" as const, component_qty: 1 },
          { component_product_id: "prod-b", component_unit: "SMALL" as const, component_qty: 2 },
          { component_product_id: "prod-c", component_unit: "LARGE" as const, component_qty: 1 },
        ],
        updatedAt: 1782896400000,
      } as never,
      rows as never,
    );

    expect(pkg.harga_jual).toBe(79000);
    expect(pkg.stok_saat_ini).toBe(4);
    expect(pkg.unit_small_name).toBe("paket");
    expect(pkg.allow_sell_in_large).toBe(false);
  });

  it("exposes package marketplace listing from derived stock and sku-only marketplace fields", () => {
    const listings = getPackageMarketplaceListings({
      id_produk: "pkg-1",
      nama_produk: "Paket A",
      harga_jual: 79000,
      stok_saat_ini: 4,
      is_active: true,
      is_marketplace: true,
      marketplace_product_name: "Paket A Marketplace",
      marketplace_sku_id: "SKU-PKT-A",
      product_kind: "PACKAGE" as const,
      unit_small_name: "paket",
      allow_sell_in_small: true,
      updatedAt: 1782896400000,
    } as never);

    expect(listings).toEqual([
      { unit: "small", marketplace_sku_id: "SKU-PKT-A", stock: 4 },
    ]);
  });
});
