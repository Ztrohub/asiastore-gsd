import type { InventoryMutationUnit, ProductRecord, StockEffectSnapshot } from "@/lib/offline/db";

type CheckoutLikeLine = {
  id_produk: string;
  nama_produk: string;
  qty: number;
  product_kind?: "NORMAL" | "PACKAGE";
  package_items?: ProductRecord["package_items"];
  unit_mutasi?: InventoryMutationUnit;
};

export function buildLineStockEffectSnapshot(line: CheckoutLikeLine): StockEffectSnapshot {
  if ((line.product_kind ?? "NORMAL") !== "PACKAGE") {
    return {
      source_kind: "NORMAL",
      effects: [
        {
          id_produk: line.id_produk,
          nama_produk_snapshot: line.nama_produk,
          unit_mutasi: line.unit_mutasi ?? "SMALL",
          qty_delta: -line.qty,
        },
      ],
    };
  }

  return {
    source_kind: "PACKAGE",
    effects: (line.package_items ?? []).map((item) => ({
      id_produk: item.component_product_id,
      nama_produk_snapshot: item.component_product_id,
      unit_mutasi: item.component_unit,
      qty_delta: -(line.qty * item.component_qty),
    })),
  };
}
