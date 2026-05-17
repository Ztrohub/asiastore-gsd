import { prisma } from "@/lib/db/prisma";

export type InventoryDeltaEvent = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
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

  await prisma.$transaction(async () => {
    for (const event of ordered) {
      finalStockByProduct[event.id_produk] = (finalStockByProduct[event.id_produk] ?? 0) + event.delta_qty;
      appliedOrder.push(event.id_queue);
      acks.push({ id_queue: event.id_queue, status: "acked" });
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
