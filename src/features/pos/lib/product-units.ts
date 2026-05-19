import type { ProductRecord, InventoryMutationUnit } from "@/lib/offline/db";

export type ProductSellUnitOption = {
  unit_mutasi: InventoryMutationUnit;
  unit_label: string;
  unit_price: number;
};

export function getSellUnitOptions(product: ProductRecord): ProductSellUnitOption[] {
  const options: ProductSellUnitOption[] = [];

  if (product.allow_sell_in_small !== false) {
    options.push({
      unit_mutasi: "SMALL",
      unit_label: product.unit_small_name?.trim() || "pcs",
      unit_price: product.harga_jual,
    });
  }

  if (
    product.allow_sell_in_large &&
    product.harga_jual_unit_besar !== undefined &&
    product.harga_jual_unit_besar > 0
  ) {
    options.push({
      unit_mutasi: "LARGE",
      unit_label: product.unit_large_name?.trim() || "besar",
      unit_price: product.harga_jual_unit_besar,
    });
  }

  return options;
}

