import type { InventoryMutationUnit } from "@/lib/offline/db";

export type ProductSpecialPriceRecord = {
  unit_mutasi: InventoryMutationUnit;
  qty_tenths: number;
  harga: number;
};

export type PricingBreakdownRow = {
  qty: number;
  // For special rows this is the displayed chunk price, not a per-1.0 unit rate.
  unit_price: number;
  total: number;
  source: "base" | "special";
};

export type PosLinePricingSnapshot = {
  base_unit_price: number;
  automatic_subtotal: number;
  rules: ProductSpecialPriceRecord[];
  breakdown: PricingBreakdownRow[];
};

export function assertValidSpecialPriceRules(rules: ProductSpecialPriceRecord[]) {
  const seen = new Set<string>();

  for (const rule of rules) {
    if (!Number.isInteger(rule.qty_tenths) || rule.qty_tenths < 1 || rule.qty_tenths > 9) {
      throw new Error("Qty harga khusus harus kelipatan 0.1 antara 0.1 sampai 0.9.");
    }
    if (!Number.isInteger(rule.harga) || rule.harga < 100 || rule.harga > 999999999) {
      throw new Error("Harga khusus harus integer IDR yang valid.");
    }

    const key = `${rule.unit_mutasi}:${rule.qty_tenths}`;
    if (seen.has(key)) {
      throw new Error("Qty harga khusus untuk unit yang sama tidak boleh duplikat.");
    }

    seen.add(key);
  }
}

export function sortSpecialPriceRules(rules: ProductSpecialPriceRecord[]) {
  return [...rules].sort((left, right) => {
    if (left.unit_mutasi !== right.unit_mutasi) {
      return left.unit_mutasi.localeCompare(right.unit_mutasi);
    }

    return right.qty_tenths - left.qty_tenths;
  });
}
