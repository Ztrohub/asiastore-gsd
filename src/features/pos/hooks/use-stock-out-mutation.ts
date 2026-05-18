"use client";

import { useCallback, useState } from "react";
import { offlineDb, type InventoryMutationUnit } from "@/lib/offline/db";
import { buildSalesOutMutationEvent, type MutationBuilderInput } from "@/lib/inventory/mutation-event";

type StockOutInput = Omit<MutationBuilderInput, "id_user" | "delta_qty"> & {
  delta_qty: number;
  unit_mutasi?: InventoryMutationUnit;
};

export async function persistStockOutMutation(input: StockOutInput) {
  const activeSession = await offlineDb.localSessions.get("active");
  if (!activeSession?.userId) {
    throw new Error("Sesi user tidak ditemukan.");
  }
  let persistedEvent: ReturnType<typeof buildSalesOutMutationEvent> | null = null;

  await offlineDb.transaction(
    "rw",
    offlineDb.products,
    offlineDb.inventoryMutationEvents,
    offlineDb.syncQueue,
    async () => {
      const currentProduct = await offlineDb.products.get(input.id_produk);
      if (!currentProduct) {
        throw new Error("Produk tidak ditemukan.");
      }

      const quantity = Math.max(1, Math.trunc(Math.abs(input.delta_qty) || 0));
      const mutationUnit = input.unit_mutasi ?? "SMALL";
      const currentSmallStock = Math.max(0, Math.trunc(currentProduct.stok_saat_ini));
      const currentLargeStock = Math.max(
        0,
        Math.trunc(currentProduct.stok_unit_besar_saat_ini ?? 0),
      );
      if (mutationUnit === "SMALL" && currentSmallStock < quantity) {
        throw new Error("Stok unit kecil tidak mencukupi.");
      }
      if (mutationUnit === "LARGE" && currentLargeStock < quantity) {
        throw new Error("Stok unit besar tidak mencukupi.");
      }

      const deltaQty = -quantity;
      const event = buildSalesOutMutationEvent({
        ...input,
        unit_mutasi: mutationUnit,
        delta_qty: deltaQty,
        id_user: activeSession.userId,
      });

      const nextSmallStock =
        mutationUnit === "SMALL"
          ? Math.max(0, currentSmallStock + deltaQty)
          : currentSmallStock;
      const nextLargeStock =
        mutationUnit === "LARGE"
          ? Math.max(0, currentLargeStock + deltaQty)
          : currentLargeStock;
      await offlineDb.products.put({
        ...currentProduct,
        stok_saat_ini: nextSmallStock,
        stok_unit_besar_saat_ini: nextLargeStock,
        updatedAt: Date.now(),
      });

      await offlineDb.inventoryMutationEvents.add(event);
      await offlineDb.syncQueue.add({
        status: "pending",
        attemptCount: 0,
        nextRetryAt: Date.now(),
        entityType: "inventory_mutation",
        entityId: event.id_queue,
        deltaPayload: JSON.stringify(event),
        allowNegativeStock: true,
        createdAt: Date.now(),
      });
      persistedEvent = event;
    },
  );

  if (!persistedEvent) {
    throw new Error("Gagal simpan stock out.");
  }
  return persistedEvent;
}

export function useStockOutMutation() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitStockOut = useCallback(async (input: StockOutInput) => {
    setSubmitting(true);
    setError(null);
    try {
      return await persistStockOutMutation(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal simpan stock out.";
      setError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submitStockOut, submitting, error };
}
