import { prisma } from "@/lib/db/prisma";

export type InventoryDeltaEvent = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
  id_user?: string;
  jenis_mutasi: "SALES_OUT" | "STOCK_IN" | "STOCK_ADJUSTMENT";
  delta_qty: number;
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
      finalStockByProduct[event.id_produk] = (finalStockByProduct[event.id_produk] ?? 0) + event.delta_qty;
      appliedOrder.push(event.id_queue);
      acks.push({ id_queue: event.id_queue, status: "acked" });
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
              delta_qty: event.delta_qty,
              logical_clock: event.received_seq,
              client_timestamp: new Date(event.client_timestamp),
            },
          });
          finalStockByProduct[event.id_produk] = (finalStockByProduct[event.id_produk] ?? 0) + event.delta_qty;
          appliedOrder.push(event.id_queue);
        }
        acks.push({ id_queue: event.id_queue, status: "acked" });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "REPLAY_WRITE_FAILED";
        acks.push({ id_queue: event.id_queue, status: "failed", reason });
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
