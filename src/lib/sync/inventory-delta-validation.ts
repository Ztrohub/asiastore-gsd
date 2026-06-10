type InventoryDeltaLike = {
  id_queue?: string;
  id_produk?: string;
  id_transaksi?: string;
  id_user?: string;
  jenis_mutasi?: string;
  unit_mutasi?: string;
  delta_qty?: number;
  logical_clock?: number;
  client_timestamp?: number;
  received_seq?: number;
};

const ALLOWED_MUTATION_TYPES = new Set(["SALES_OUT", "STOCK_IN", "STOCK_ADJUSTMENT"]);
const ALLOWED_MUTATION_UNITS = new Set(["SMALL", "LARGE"]);

export function isValidInventoryDeltaEvent(event: InventoryDeltaLike) {
  const deltaQty = event.delta_qty;
  const logicalClock = event.logical_clock;
  const clientTimestamp = event.client_timestamp;
  const receivedSeq = event.received_seq;

  return Boolean(
    event.id_queue &&
      event.id_produk &&
      event.id_transaksi &&
      event.id_user &&
      ALLOWED_MUTATION_TYPES.has(event.jenis_mutasi ?? "") &&
      (event.unit_mutasi === undefined || ALLOWED_MUTATION_UNITS.has(event.unit_mutasi)) &&
      typeof deltaQty === "number" &&
      Number.isFinite(deltaQty) &&
      deltaQty !== 0 &&
      typeof logicalClock === "number" &&
      Number.isInteger(logicalClock) &&
      logicalClock >= 0 &&
      typeof clientTimestamp === "number" &&
      Number.isInteger(clientTimestamp) &&
      clientTimestamp > 0 &&
      typeof receivedSeq === "number" &&
      Number.isInteger(receivedSeq) &&
      receivedSeq >= 0,
  );
}
