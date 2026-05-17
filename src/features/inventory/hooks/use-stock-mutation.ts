"use client";

import { useCallback, useState } from "react";
import { offlineDb } from "@/lib/offline/db";
import {
  buildStockAdjustmentMutationEvent,
  buildStockInMutationEvent,
  type MutationBuilderInput,
} from "@/lib/inventory/mutation-event";

type MutationKind = "STOCK_IN" | "STOCK_ADJUSTMENT";

type StockMutationInput = Omit<MutationBuilderInput, "id_user"> & {
  jenis_mutasi: MutationKind;
};

export async function persistStockMutation(input: StockMutationInput) {
  const activeSession = await offlineDb.localSessions.get("active");
  if (!activeSession?.userId) {
    throw new Error("Sesi user tidak ditemukan.");
  }

  const baseInput: MutationBuilderInput = {
    ...input,
    id_user: activeSession.userId,
  };
  const event =
    input.jenis_mutasi === "STOCK_IN"
      ? buildStockInMutationEvent(baseInput)
      : buildStockAdjustmentMutationEvent(baseInput);

  await offlineDb.transaction(
    "rw",
    offlineDb.inventoryMutationEvents,
    offlineDb.syncQueue,
    async () => {
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
    },
  );

  return event;
}

export function useStockMutation() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useCallback(async (input: StockMutationInput) => {
    setSubmitting(true);
    setError(null);
    try {
      return await persistStockMutation(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal simpan mutasi stok.";
      setError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submitMutation, submitting, error };
}
