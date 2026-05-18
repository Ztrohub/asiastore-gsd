import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type InventoryDeltaEvent = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
  id_user?: string;
  jenis_mutasi: "SALES_OUT" | "STOCK_IN" | "STOCK_ADJUSTMENT";
  unit_mutasi?: "SMALL" | "LARGE";
  delta_qty: number;
  logical_clock: number;
  received_seq: number;
  client_timestamp: number;
};

type ReplayResult = {
  appliedOrder: string[];
  acks: Array<{ id_queue: string; status: "acked" | "failed"; reason?: string }>;
  finalStockByProduct: Record<string, number>;
  transactionMode: "sequential";
  orderingPolicy: "fifo_server_receive_then_client_timestamp";
};

const KNOWN_REPLAY_FAILURE_REASONS = new Set([
  "MISSING_USER_ID",
  "PRODUCT_NOT_FOUND",
  "OUT_OF_STOCK_SMALL",
  "OUT_OF_STOCK_LARGE",
]);

function mapReplayFailureReason(error: unknown): string {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return "PRODUCT_NOT_FOUND";
  }
  if (!(error instanceof Error)) {
    return "REPLAY_WRITE_FAILED";
  }
  if (KNOWN_REPLAY_FAILURE_REASONS.has(error.message)) {
    return error.message;
  }
  return "REPLAY_WRITE_FAILED";
}

function isDuplicateQueueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    error.meta.target.includes("id_queue")
  );
}

function orderEvents(events: InventoryDeltaEvent[]) {
  return [...events].sort((a, b) => {
    if (a.received_seq !== b.received_seq) return a.received_seq - b.received_seq;
    return a.client_timestamp - b.client_timestamp;
  });
}

export async function applyInventoryDeltaBatch(events: InventoryDeltaEvent[]): Promise<ReplayResult> {
  const ordered = orderEvents(events);
  const finalStockByProduct: Record<string, number> = {};
  const appliedOrder: string[] = [];
  const acks: Array<{ id_queue: string; status: "acked" | "failed"; reason?: string }> = [];

  if (!process.env.DATABASE_URL) {
    for (const event of ordered) {
      acks.push({ id_queue: event.id_queue, status: "failed", reason: "SERVER_DB_UNAVAILABLE" });
    }
    return {
      appliedOrder,
      acks,
      finalStockByProduct,
      transactionMode: "sequential",
      orderingPolicy: "fifo_server_receive_then_client_timestamp",
    };
  }

  await prisma.$transaction(async (tx) => {
    for (const event of ordered) {
      try {
        const existing = await tx.inventoryMutationEvent.findUnique({
          where: { id_queue: event.id_queue },
          select: { id_queue: true },
        });
        if (!existing) {
          if (!event.id_user) {
            throw new Error("MISSING_USER_ID");
          }
          await tx.inventoryMutationEvent.create({
            data: {
              id_queue: event.id_queue,
              id_transaksi: event.id_transaksi,
              id_produk: event.id_produk,
              id_user: event.id_user,
              jenis_mutasi: event.jenis_mutasi,
              unit_mutasi: event.unit_mutasi ?? "SMALL",
              delta_qty: event.delta_qty,
              logical_clock: event.logical_clock,
              client_timestamp: new Date(event.client_timestamp),
            },
          });

          const currentProduct = await tx.product.findUnique({
            where: { id_produk: event.id_produk },
            select: { stok_saat_ini: true, stok_unit_besar_saat_ini: true },
          });
          if (!currentProduct) {
            throw new Error("PRODUCT_NOT_FOUND");
          }

          const mutationUnit = event.unit_mutasi ?? "SMALL";
          const currentSmallStock = Math.max(0, Math.trunc(currentProduct.stok_saat_ini));
          const currentLargeStock = Math.max(
            0,
            Math.trunc(currentProduct.stok_unit_besar_saat_ini ?? 0),
          );
          let nextSmallStock = currentSmallStock;
          let nextLargeStock = currentLargeStock;

          if (mutationUnit === "SMALL") {
            nextSmallStock = currentSmallStock + event.delta_qty;
            if (nextSmallStock < 0) {
              throw new Error("OUT_OF_STOCK_SMALL");
            }
          } else {
            nextLargeStock = currentLargeStock + event.delta_qty;
            if (nextLargeStock < 0) {
              throw new Error("OUT_OF_STOCK_LARGE");
            }
          }

          await tx.product.update({
            where: { id_produk: event.id_produk },
            data: {
              stok_saat_ini: nextSmallStock,
              stok_unit_besar_saat_ini: nextLargeStock,
              last_synced_at: new Date(event.client_timestamp),
            },
          });
          finalStockByProduct[event.id_produk] = nextSmallStock;
          appliedOrder.push(event.id_queue);
        }
        acks.push({ id_queue: event.id_queue, status: "acked" });
      } catch (error) {
        if (isDuplicateQueueError(error)) {
          acks.push({ id_queue: event.id_queue, status: "acked" });
          continue;
        }
        acks.push({ id_queue: event.id_queue, status: "failed", reason: mapReplayFailureReason(error) });
      }
    }
  });

  return {
    appliedOrder,
    acks,
    finalStockByProduct,
    transactionMode: "sequential",
    orderingPolicy: "fifo_server_receive_then_client_timestamp",
  };
}
