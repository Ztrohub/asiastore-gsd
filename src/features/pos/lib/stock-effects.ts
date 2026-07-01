import type { InventoryMutationUnit, ProductRecord, StockEffectSnapshot } from "@/lib/offline/db";

type CheckoutLikeLine = {
  id_produk: string;
  nama_produk: string;
  qty: number;
  product_kind?: "NORMAL" | "PACKAGE";
  package_items?: ProductRecord["package_items"];
  unit_mutasi?: InventoryMutationUnit;
};

type TransactionLikeLine = Pick<
  CheckoutLikeLine,
  "id_produk" | "nama_produk" | "qty" | "unit_mutasi"
> & {
  stock_effect_snapshot?: StockEffectSnapshot;
};

type StockEffectKey = `${string}:${InventoryMutationUnit}`;

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

function toEffectMap(lines: TransactionLikeLine[]) {
  const map = new Map<
    StockEffectKey,
    { id_produk: string; unit_mutasi: InventoryMutationUnit; qty_delta: number }
  >();

  for (const line of lines) {
    const snapshot =
      line.stock_effect_snapshot ??
      buildLineStockEffectSnapshot({
        id_produk: line.id_produk,
        nama_produk: line.nama_produk,
        qty: line.qty,
        unit_mutasi: line.unit_mutasi,
      });

    for (const effect of snapshot.effects) {
      const key = `${effect.id_produk}:${effect.unit_mutasi}`;
      const current =
        map.get(key) ??
        {
          id_produk: effect.id_produk,
          unit_mutasi: effect.unit_mutasi,
          qty_delta: 0,
        };
      current.qty_delta += effect.qty_delta;
      map.set(key, current);
    }
  }

  return map;
}

export function diffStockEffectMaps(oldLines: TransactionLikeLine[], newLines: TransactionLikeLine[]) {
  const previous = toEffectMap(oldLines);
  const next = toEffectMap(newLines);
  const keys = new Set([...previous.keys(), ...next.keys()]);

  return [...keys].flatMap((key) => {
    const before = previous.get(key)?.qty_delta ?? 0;
    const after = next.get(key)?.qty_delta ?? 0;
    const delta = after - before;
    if (delta === 0) {
      return [];
    }

    const seed = next.get(key) ?? previous.get(key)!;
    return [
      {
        id_produk: seed.id_produk,
        unit_mutasi: seed.unit_mutasi,
        qty_delta: delta,
      },
    ];
  });
}
