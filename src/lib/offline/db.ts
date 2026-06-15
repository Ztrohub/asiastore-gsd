import Dexie, { type EntityTable } from "dexie";

export type CredentialCacheRecord = {
  userId: string;
  username: string;
  encryptedVerifier: string;
  salt: string;
  iv: string;
  iterations: number;
  passwordVersion: number;
  role: "OWNER" | "CASHIER";
  updatedAt: number;
};

export type LocalSessionRecord = {
  key: "active";
  userId: string;
  username: string;
  role: "OWNER" | "CASHIER";
  passwordVersion: number;
  lastActivityAt: number;
  mustReloginAt: number;
};

export type SyncQueueRecord = {
  id?: number;
  status: "pending" | "sent" | "acked" | "failed";
  attemptCount: number;
  nextRetryAt: number;
  lastAttemptAt?: number;
  entityType: string;
  entityId: string;
  deltaPayload: string;
  allowNegativeStock: boolean;
  createdAt: number;
};

export type AppMetaRecord = {
  key: string;
  value: string;
};

export type InventoryMutationType = "SALES_OUT" | "STOCK_IN" | "STOCK_ADJUSTMENT";
export type InventoryMutationUnit = "SMALL" | "LARGE";

export type InventoryMutationEventRecord = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
  id_user: string;
  jenis_mutasi: InventoryMutationType;
  unit_mutasi: InventoryMutationUnit;
  delta_qty: number;
  logical_clock: number;
  client_timestamp: number;
  createdAt: number;
};

export type ProductRecord = {
  id_produk: string;
  nama_produk: string;
  sku?: string;
  harga_jual: number;
  harga_jual_unit_besar?: number;
  stok_saat_ini: number;
  stok_unit_besar_saat_ini?: number;
  is_active: boolean;
  unit_small_name?: string;
  unit_large_name?: string;
  unit_large_to_small?: number;
  allow_buy_in_small?: boolean;
  allow_buy_in_large?: boolean;
  allow_sell_in_small?: boolean;
  allow_sell_in_large?: boolean;
  updatedAt: number;
};

class LocalPosDatabase extends Dexie {
  credentialCache!: EntityTable<CredentialCacheRecord, "username">;
  localSessions!: EntityTable<LocalSessionRecord, "key">;
  syncQueue!: EntityTable<SyncQueueRecord, "id">;
  appMeta!: EntityTable<AppMetaRecord, "key">;
  inventoryMutationEvents!: EntityTable<InventoryMutationEventRecord, "id_queue">;
  products!: EntityTable<ProductRecord, "id_produk">;

  constructor() {
    super("asiatek-pos-local-db");
    this.version(1).stores({
      credentialCache: "username, updatedAt, passwordVersion, role",
      localSessions: "key, username, lastActivityAt, mustReloginAt",
      syncQueue:
        "++id, status, attemptCount, nextRetryAt, entityType, entityId, createdAt",
      appMeta: "key",
    });
    this.version(2).stores({
      credentialCache: "username, userId, updatedAt, passwordVersion, role",
      localSessions: "key, username, lastActivityAt, mustReloginAt",
      syncQueue:
        "++id, status, attemptCount, nextRetryAt, entityType, entityId, createdAt",
      appMeta: "key",
    });
    this.version(3).stores({
      credentialCache: "username, userId, updatedAt, passwordVersion, role",
      localSessions: "key, username, lastActivityAt, mustReloginAt",
      syncQueue:
        "++id, status, attemptCount, nextRetryAt, entityType, entityId, createdAt",
      appMeta: "key",
      inventoryMutationEvents:
        "id_queue, id_transaksi, id_produk, id_user, jenis_mutasi, client_timestamp, logical_clock",
    });
    this.version(4).stores({
      credentialCache: "username, userId, updatedAt, passwordVersion, role",
      localSessions: "key, username, lastActivityAt, mustReloginAt",
      syncQueue:
        "++id, status, attemptCount, nextRetryAt, entityType, entityId, createdAt",
      appMeta: "key",
      inventoryMutationEvents:
        "id_queue, id_transaksi, id_produk, id_user, jenis_mutasi, client_timestamp, logical_clock",
      products: "id_produk, nama_produk, sku, harga_jual, stok_saat_ini, is_active, updatedAt",
    });
    this.version(5).stores({
      credentialCache: "username, userId, updatedAt, passwordVersion, role",
      localSessions: "key, username, lastActivityAt, mustReloginAt",
      syncQueue:
        "++id, status, attemptCount, nextRetryAt, entityType, entityId, createdAt",
      appMeta: "key",
      inventoryMutationEvents:
        "id_queue, id_transaksi, id_produk, id_user, jenis_mutasi, unit_mutasi, client_timestamp, logical_clock",
      products:
        "id_produk, nama_produk, sku, harga_jual, harga_jual_unit_besar, stok_saat_ini, stok_unit_besar_saat_ini, is_active, updatedAt",
    });
  }
}

export const offlineDb = new LocalPosDatabase();
