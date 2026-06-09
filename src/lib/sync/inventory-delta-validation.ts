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
  return Boolean(
    event.id_queue &&
      event.id_produk &&
      event.id_transaksi &&
      event.id_user &&
      ALLOWED_MUTATION_TYPES.has(event.jenis_mutasi ?? "") &&
      (event.unit_mutasi === undefined || ALLOWED_MUTATION_UNITS.has(event.unit_mutasi)) &&
      Number.isFinite(event.delta_qty) &&
      event.delta_qty !== 0 &&
      Number.isInteger(event.logical_clock) &&
      event.logical_clock >= 0 &&
      Number.isInteger(event.client_timestamp) &&
      event.client_timestamp > 0 &&
      Number.isInteger(event.received_seq) &&
      event.received_seq >= 0,
  );
}
