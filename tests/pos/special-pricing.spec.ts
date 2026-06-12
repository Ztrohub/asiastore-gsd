import { describe, expect, it } from "vitest";

import { resolveLinePricing } from "@/features/pos/lib/special-pricing";

describe("special price resolver", () => {
  it("uses an exact special-price rule before smaller chunks", () => {
    const resolved = resolveLinePricing({
      qty: 0.4,
      unit_mutasi: "SMALL",
      baseUnitPrice: 10000,
      rules: [
        { unit_mutasi: "SMALL", qty_tenths: 4, harga: 4700 },
        { unit_mutasi: "SMALL", qty_tenths: 2, harga: 2500 },
      ],
    });

    expect(resolved.automatic_subtotal).toBe(4700);
    expect(resolved.breakdown).toEqual([
      { qty: 0.4, unit_price: 4700, total: 4700, source: "special" },
    ]);
  });

  it("mixes base quantity and exact special chunks for fractional remainders", () => {
    const resolved = resolveLinePricing({
      qty: 1.6,
      unit_mutasi: "SMALL",
      baseUnitPrice: 10000,
      rules: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
    });

    expect(resolved.automatic_subtotal).toBe(17000);
    expect(resolved.breakdown).toEqual([
      { qty: 1.1, unit_price: 10000, total: 11000, source: "base" },
      { qty: 0.5, unit_price: 6000, total: 6000, source: "special" },
    ]);
  });

  it("falls back to base remainder after using the best non-exact special coverage", () => {
    const resolved = resolveLinePricing({
      qty: 0.3,
      unit_mutasi: "SMALL",
      baseUnitPrice: 10000,
      rules: [{ unit_mutasi: "SMALL", qty_tenths: 2, harga: 2500 }],
    });

    expect(resolved.automatic_subtotal).toBe(3500);
    expect(resolved.breakdown).toEqual([
      { qty: 0.1, unit_price: 10000, total: 1000, source: "base" },
      { qty: 0.2, unit_price: 2500, total: 2500, source: "special" },
    ]);
  });

  it("rejects qty values with more than one decimal place", () => {
    expect(() =>
      resolveLinePricing({
        qty: 1.64,
        unit_mutasi: "SMALL",
        baseUnitPrice: 10000,
        rules: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
      }),
    ).toThrow("Qty hanya mendukung 1 angka desimal.");
  });
});
