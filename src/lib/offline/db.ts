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

export type InventoryMutationEventRecord = {
  id_queue: string;
  id_transaksi: string;
  id_produk: string;
  id_user: string;
  jenis_mutasi: InventoryMutationType;
  delta_qty: number;
  logical_clock: number;
  client_timestamp: number;
  createdAt: number;
};

class LocalPosDatabase extends Dexie {
  credentialCache!: EntityTable<CredentialCacheRecord, "username">;
  localSessions!: EntityTable<LocalSessionRecord, "key">;
  syncQueue!: EntityTable<SyncQueueRecord, "id">;
  appMeta!: EntityTable<AppMetaRecord, "key">;
  inventoryMutationEvents!: EntityTable<InventoryMutationEventRecord, "id_queue">;

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
  }
}

export const offlineDb = new LocalPosDatabase();
