"use client";

import { useState } from "react";
import type { ProductRecord } from "@/lib/offline/db";
import type { InventoryMutationUnit } from "@/lib/offline/db";

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
};

export function usePosCart() {
  const [lines, setLines] = useState<PosCartLine[]>([]);
  const [cartIndex, setCartIndex] = useState(0);
  const [note, setNote] = useState("");

  function upsertLine(
    product: Pick<ProductRecord, "id_produk" | "nama_produk" | "harga_jual">,
    qty: number,
    selectedUnit: PosCartUnitOption,
    lineDiscount = 0,
  ) {
    setLines((current) => {
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
            line_discount: Math.max(0, Math.trunc(lineDiscount)),
            unit_mutasi: selectedUnit.unit_mutasi,
            unit_label: selectedUnit.unit_label,
          },
        ];
      }

      const maxDiscount = selectedUnit.unit_price * qty;
      const next = [...current];
      next[idx] = {
        ...next[idx],
        nama_produk: `${product.nama_produk} (${selectedUnit.unit_label})`,
        nama_produk_dasar: product.nama_produk,
        harga_jual: selectedUnit.unit_price,
        qty,
        line_discount: Math.max(0, Math.min(Math.trunc(lineDiscount), maxDiscount)),
        unit_mutasi: selectedUnit.unit_mutasi,
        unit_label: selectedUnit.unit_label,
      };
      return next;
    });
  }

  function setLineDiscount(index: number, value: number) {
    setLines((current) => {
      const line = current[index];
      if (!line) return current;
      const maxDiscount = line.harga_jual * line.qty;
      const next = [...current];
      next[index] = {
        ...line,
        line_discount: Math.max(0, Math.min(Math.trunc(value), maxDiscount)),
      };
      return next;
    });
  }

  function updateLineBySubtotal(index: number, nextQty: number, nextFinalSubtotal: number) {
    setLines((current) => {
      const line = current[index];
      if (!line) return current;
      const normalizedQty = Math.max(0, nextQty);
      const baseTotal = line.harga_jual * normalizedQty;
      const cappedSubtotal = Math.max(0, Math.min(nextFinalSubtotal, baseTotal));
      const next = [...current];
      next[index] = {
        ...line,
        qty: normalizedQty,
        line_discount: Math.max(0, baseTotal - cappedSubtotal),
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
