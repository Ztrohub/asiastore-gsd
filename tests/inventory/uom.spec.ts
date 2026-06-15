import { describe, expect, it } from "vitest";
import {
  convertQuantityToSmallUnits,
  describeStockBreakdown,
  normalizeProductUom,
} from "@/lib/inventory/uom";

const product = normalizeProductUom({
  id_produk: "p-1",
  nama_produk: "Produk Uji",
  harga_jual: 10000,
  stok_saat_ini: 11,
  is_active: true,
  updatedAt: Date.now(),
  unit_small_name: "pcs",
  unit_large_name: "dus",
  unit_large_to_small: 12,
  allow_buy_in_small: true,
  allow_buy_in_large: true,
  allow_sell_in_small: true,
  allow_sell_in_large: true,
});

describe("inventory uom conversion", () => {
  it("converts large unit to small units for stock in", () => {
    const converted = convertQuantityToSmallUnits({
      product,
      quantity: 2,
      unit: "large",
      flow: "purchase",
    });

    expect(converted).toBe(24);
  });

  it("supports partial stock breakdown without forcing repack", () => {
    const breakdown = describeStockBreakdown(product);

    expect(breakdown).toEqual(
      expect.objectContaining({
        fullLarge: 0,
        remainderSmall: 11,
        largeUnitName: "dus",
        smallUnitName: "pcs",
      }),
    );
  });

  it("rejects large sale when product does not allow large sale", () => {
    const smallOnlySaleProduct = {
      ...product,
      allow_sell_in_large: false,
    };

    expect(() =>
      convertQuantityToSmallUnits({
        product: smallOnlySaleProduct,
        quantity: 1,
        unit: "large",
        flow: "sale",
      }),
    ).toThrow("Unit besar tidak diizinkan untuk transaksi ini.");
  });
});
