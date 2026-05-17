"use client";

import { useCallback, useState } from "react";
import { offlineDb } from "@/lib/offline/db";
import { buildSalesOutMutationEvent, type MutationBuilderInput } from "@/lib/inventory/mutation-event";

type StockOutInput = Omit<MutationBuilderInput, "id_user">;

export async function persistStockOutMutation(input: StockOutInput) {
  const activeSession = await offlineDb.localSessions.get("active");
  if (!activeSession?.userId) {
    throw new Error("Sesi user tidak ditemukan.");
  }

  const event = buildSalesOutMutationEvent({
    ...input,
    id_user: activeSession.userId,
  });

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
