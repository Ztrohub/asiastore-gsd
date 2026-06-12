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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeInteger(value: unknown, minimum = 0) {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value) || value < minimum) {
    return undefined;
  }

  return value;
}

function normalizeQty(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  const qtyTenths = value * 10;
  if (!Number.isInteger(qtyTenths)) {
    return undefined;
  }

  return value;
}

function normalizeUnit(value: unknown): InventoryMutationUnit | undefined {
  return value === "SMALL" || value === "LARGE" ? value : undefined;
}

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

export function normalizePricingSnapshot(value: unknown): PosLinePricingSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const baseUnitPrice = normalizeInteger(value.base_unit_price);
  const automaticSubtotal = normalizeInteger(value.automatic_subtotal);
  if (baseUnitPrice === undefined || automaticSubtotal === undefined) {
    return undefined;
  }

  if (!Array.isArray(value.rules) || !Array.isArray(value.breakdown)) {
    return undefined;
  }

  const rules = value.rules
    .map((rule) => {
      if (!isRecord(rule)) {
        return undefined;
      }

      const unit_mutasi = normalizeUnit(rule.unit_mutasi);
      const qty_tenths = normalizeInteger(rule.qty_tenths, 1);
      const harga = normalizeInteger(rule.harga, 0);
      if (!unit_mutasi || qty_tenths === undefined || harga === undefined) {
        return undefined;
      }

      return { unit_mutasi, qty_tenths, harga };
    })
    .filter((rule): rule is ProductSpecialPriceRecord => Boolean(rule));

  if (rules.length !== value.rules.length) {
    return undefined;
  }

  try {
    assertValidSpecialPriceRules(rules);
  } catch {
    return undefined;
  }

  const breakdown = value.breakdown
    .map((row) => {
      if (!isRecord(row)) {
        return undefined;
      }

      const qty = normalizeQty(row.qty);
      const unit_price = normalizeInteger(row.unit_price, 0);
      const total = normalizeInteger(row.total, 0);
      const source = row.source === "base" || row.source === "special" ? row.source : undefined;
      if (qty === undefined || unit_price === undefined || total === undefined || source === undefined) {
        return undefined;
      }

      return { qty, unit_price, total, source };
    })
    .filter((row): row is PricingBreakdownRow => Boolean(row));

  if (breakdown.length !== value.breakdown.length) {
    return undefined;
  }

  if (breakdown.reduce((sum, row) => sum + row.total, 0) !== automaticSubtotal) {
    return undefined;
  }

  return {
    base_unit_price: baseUnitPrice,
    automatic_subtotal: automaticSubtotal,
    rules: sortSpecialPriceRules(rules),
    breakdown,
  };
}
