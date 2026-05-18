import type {
  InventoryMutationEventRecord,
  InventoryMutationType,
  InventoryMutationUnit,
} from "@/lib/offline/db";

export type MutationBuilderInput = {
  id_transaksi: string;
  id_produk: string;
  id_user: string;
  delta_qty: number;
  unit_mutasi?: InventoryMutationUnit;
  logical_clock: number;
  client_timestamp?: number;
};
const MAX_INT32 = 2_147_483_647;

function normalizeLogicalClock(input: number) {
  if (input <= MAX_INT32) return input;
  const seconds = Math.trunc(input / 1000);
  if (seconds <= MAX_INT32) return seconds;
  return seconds % MAX_INT32;
}

function ensureRequiredFields(input: MutationBuilderInput, jenis_mutasi: InventoryMutationType) {
  if (!input.id_transaksi || !input.id_produk || !input.id_user) {
    throw new Error("Metadata mutasi stok tidak lengkap.");
  }
  if (!Number.isFinite(input.delta_qty) || input.delta_qty === 0) {
    throw new Error("Delta qty mutasi stok tidak valid.");
  }
  if (!Number.isInteger(input.logical_clock) || input.logical_clock < 0) {
    throw new Error("Logical clock mutasi stok tidak valid.");
  }
  if (!["SALES_OUT", "STOCK_IN", "STOCK_ADJUSTMENT"].includes(jenis_mutasi)) {
    throw new Error("Jenis mutasi stok tidak valid.");
  }
  if (input.unit_mutasi && !["SMALL", "LARGE"].includes(input.unit_mutasi)) {
    throw new Error("Unit mutasi stok tidak valid.");
  }
}

function createMutationEvent(
  jenis_mutasi: InventoryMutationType,
  input: MutationBuilderInput,
): InventoryMutationEventRecord {
  ensureRequiredFields(input, jenis_mutasi);
  return {
    id_queue: crypto.randomUUID(),
    id_transaksi: input.id_transaksi,
    id_produk: input.id_produk,
    id_user: input.id_user,
    jenis_mutasi,
    unit_mutasi: input.unit_mutasi ?? "SMALL",
    delta_qty: input.delta_qty,
    logical_clock: normalizeLogicalClock(input.logical_clock),
    client_timestamp: input.client_timestamp ?? Date.now(),
    createdAt: Date.now(),
  };
}

export function buildStockInMutationEvent(input: MutationBuilderInput) {
  return createMutationEvent("STOCK_IN", input);
}

export function buildStockAdjustmentMutationEvent(input: MutationBuilderInput) {
  return createMutationEvent("STOCK_ADJUSTMENT", input);
}

export function buildSalesOutMutationEvent(input: MutationBuilderInput) {
  return createMutationEvent("SALES_OUT", input);
}
