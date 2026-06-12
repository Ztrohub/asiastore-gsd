"use client";

import { useState } from "react";
import { resolveLinePricing } from "@/features/pos/lib/special-pricing";
import type { ProductRecord } from "@/lib/offline/db";
import type { InventoryMutationUnit } from "@/lib/offline/db";
import type { PosLinePricingSnapshot } from "@/lib/pricing/special-price";

export type PosCartUnitOption = {
  unit_mutasi: InventoryMutationUnit;
  unit_label: string;
  unit_price: number;
};

export type PosCartLine = {
  id_produk: string;
  nama_produk: string;
  nama_produk_dasar: string;
  harga_jual: number;
  qty: number;
  line_discount: number;
  unit_mutasi: InventoryMutationUnit;
  unit_label: string;
  pricing_snapshot: PosLinePricingSnapshot;
};

function createPricingSnapshot(params: {
  qty: number;
  unit_mutasi: InventoryMutationUnit;
  unit_price: number;
  rules: ProductRecord["special_prices"];
}) {
  return resolveLinePricing({
    qty: params.qty,
    unit_mutasi: params.unit_mutasi,
    baseUnitPrice: params.unit_price,
    rules: params.rules ?? [],
  });
}

function getAutomaticSubtotal(line: Pick<PosCartLine, "harga_jual" | "qty" | "pricing_snapshot">) {
  return line.pricing_snapshot.automatic_subtotal;
}

function clampLineDiscount(value: number, automaticSubtotal: number) {
  return Math.max(0, Math.min(Math.trunc(value), automaticSubtotal));
}

export function usePosCart() {
  const [lines, setLines] = useState<PosCartLine[]>([]);
  const [cartIndex, setCartIndex] = useState(0);
  const [note, setNote] = useState("");

  function upsertLine(
    product: Pick<ProductRecord, "id_produk" | "nama_produk" | "harga_jual" | "special_prices">,
    qty: number,
    selectedUnit: PosCartUnitOption,
    lineDiscount = 0,
  ) {
    setLines((current) => {
      const pricingSnapshot = createPricingSnapshot({
        qty,
        unit_mutasi: selectedUnit.unit_mutasi,
        unit_price: selectedUnit.unit_price,
        rules: product.special_prices,
      });
      const idx = current.findIndex(
        (line) =>
          line.id_produk === product.id_produk && line.unit_mutasi === selectedUnit.unit_mutasi,
      );
      if (idx === -1) {
        return [
          ...current,
          {
            id_produk: product.id_produk,
            nama_produk: `${product.nama_produk} (${selectedUnit.unit_label})`,
            nama_produk_dasar: product.nama_produk,
            harga_jual: selectedUnit.unit_price,
            qty,
            line_discount: clampLineDiscount(lineDiscount, pricingSnapshot.automatic_subtotal),
            unit_mutasi: selectedUnit.unit_mutasi,
            unit_label: selectedUnit.unit_label,
            pricing_snapshot: pricingSnapshot,
          },
        ];
      }

      const next = [...current];
      next[idx] = {
        ...next[idx],
        nama_produk: `${product.nama_produk} (${selectedUnit.unit_label})`,
        nama_produk_dasar: product.nama_produk,
        harga_jual: selectedUnit.unit_price,
        qty,
        line_discount: clampLineDiscount(lineDiscount, pricingSnapshot.automatic_subtotal),
        unit_mutasi: selectedUnit.unit_mutasi,
        unit_label: selectedUnit.unit_label,
        pricing_snapshot: pricingSnapshot,
      };
      return next;
    });
  }

  function setLineDiscount(index: number, value: number) {
    setLines((current) => {
      const line = current[index];
      if (!line) return current;
      const next = [...current];
      next[index] = {
        ...line,
        line_discount: clampLineDiscount(value, getAutomaticSubtotal(line)),
      };
      return next;
    });
  }

  function updateLineBySubtotal(index: number, nextQty: number, nextFinalSubtotal: number) {
    setLines((current) => {
      const line = current[index];
      if (!line) return current;
      const normalizedQty = Math.max(0, nextQty);
      const pricingSnapshot = createPricingSnapshot({
        qty: normalizedQty,
        unit_mutasi: line.unit_mutasi,
        unit_price: line.pricing_snapshot.base_unit_price,
        rules: line.pricing_snapshot.rules,
      });
      const automaticSubtotal = pricingSnapshot.automatic_subtotal;
      const cappedSubtotal = Math.max(0, Math.min(nextFinalSubtotal, automaticSubtotal));
      const next = [...current];
      next[index] = {
        ...line,
        qty: normalizedQty,
        line_discount: Math.max(0, automaticSubtotal - cappedSubtotal),
        pricing_snapshot: pricingSnapshot,
      };
      return next;
    });
  }

  function removeAt(index: number) {
    setLines((current) => {
      const next = current.filter((_, rowIdx) => rowIdx !== index);
      const nextIdx = Math.max(0, Math.min(index, next.length - 1));
      setCartIndex(nextIdx < 0 ? 0 : nextIdx);
      return next;
    });
  }

  function clearCart() {
    setLines([]);
    setCartIndex(0);
    setNote("");
  }

  return {
    lines,
    cartIndex,
    setCartIndex,
    note,
    setNote,
    upsertLine,
    setLineDiscount,
    updateLineBySubtotal,
    removeAt,
    clearCart,
  };
}
