import type { InventoryMutationUnit } from "@/lib/offline/db";
import {
  assertValidSpecialPriceRules,
  sortSpecialPriceRules,
  type PosLinePricingSnapshot,
  type PricingBreakdownRow,
  type ProductSpecialPriceRecord,
} from "@/lib/pricing/special-price";

function toQty(tenths: number) {
  return tenths / 10;
}

function sumTenths(rules: ProductSpecialPriceRecord[]) {
  return rules.reduce((sum, rule) => sum + rule.qty_tenths, 0);
}

function shouldReplaceBest(
  candidate: ProductSpecialPriceRecord[],
  best: ProductSpecialPriceRecord[],
) {
  const candidateTenths = sumTenths(candidate);
  const bestTenths = sumTenths(best);

  if (candidateTenths !== bestTenths) {
    return candidateTenths > bestTenths;
  }

  if (candidate.length !== best.length) {
    return candidate.length < best.length;
  }

  for (let index = 0; index < candidate.length; index += 1) {
    const candidateTenthsAtIndex = candidate[index]?.qty_tenths ?? 0;
    const bestTenthsAtIndex = best[index]?.qty_tenths ?? 0;

    if (candidateTenthsAtIndex !== bestTenthsAtIndex) {
      return candidateTenthsAtIndex > bestTenthsAtIndex;
    }
  }

  return false;
}

function pickBestFractionalRules(remainingTenths: number, rules: ProductSpecialPriceRecord[]) {
  let best: ProductSpecialPriceRecord[] = [];

  function visit(availableTenths: number, picked: ProductSpecialPriceRecord[]) {
    const sortedPicked = [...picked].sort((left, right) => right.qty_tenths - left.qty_tenths);

    if (sortedPicked.length > 0 && shouldReplaceBest(sortedPicked, best)) {
      best = sortedPicked;
    }

    for (const rule of rules) {
      if (rule.qty_tenths > availableTenths) {
        continue;
      }

      visit(availableTenths - rule.qty_tenths, [...picked, rule]);
    }
  }

  visit(remainingTenths, []);

  return best;
}

export function resolveLinePricing(params: {
  qty: number;
  unit_mutasi: InventoryMutationUnit;
  baseUnitPrice: number;
  rules: ProductSpecialPriceRecord[];
}): PosLinePricingSnapshot {
  const sortedRules = sortSpecialPriceRules(params.rules);
  assertValidSpecialPriceRules(sortedRules);

  const scaledQty = params.qty * 10;
  const totalTenths = Math.round(scaledQty);
  if (Math.abs(scaledQty - totalTenths) > Number.EPSILON) {
    throw new Error("Qty hanya mendukung 1 angka desimal.");
  }

  const wholeUnits = Math.floor(totalTenths / 10);
  const fractionalTenths = totalTenths % 10;
  const unitRules = sortedRules.filter((rule) => rule.unit_mutasi === params.unit_mutasi);

  const exactRule = unitRules.find((rule) => rule.qty_tenths === fractionalTenths);
  const chosenRules =
    fractionalTenths === 0
      ? []
      : exactRule
        ? [exactRule]
        : pickBestFractionalRules(fractionalTenths, unitRules);

  const coveredTenths = sumTenths(chosenRules);
  const baseTenths = wholeUnits * 10 + Math.max(0, fractionalTenths - coveredTenths);
  const baseTotal = Math.round((baseTenths / 10) * params.baseUnitPrice);
  const specialRows: PricingBreakdownRow[] = chosenRules.map((rule) => ({
    qty: toQty(rule.qty_tenths),
    unit_price: rule.harga,
    total: rule.harga,
    source: "special",
  }));

  const breakdown: PricingBreakdownRow[] = [];
  if (baseTenths > 0) {
    breakdown.push({
      qty: toQty(baseTenths),
      unit_price: params.baseUnitPrice,
      total: baseTotal,
      source: "base",
    });
  }
  breakdown.push(...specialRows);

  return {
    base_unit_price: params.baseUnitPrice,
    automatic_subtotal: baseTotal + specialRows.reduce((sum, row) => sum + row.total, 0),
    rules: unitRules,
    breakdown,
  };
}
