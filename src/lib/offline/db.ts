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

class LocalPosDatabase extends Dexie {
  credentialCache!: EntityTable<CredentialCacheRecord, "username">;
  localSessions!: EntityTable<LocalSessionRecord, "key">;
  syncQueue!: EntityTable<SyncQueueRecord, "id">;
  appMeta!: EntityTable<AppMetaRecord, "key">;

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
  }
}

export const offlineDb = new LocalPosDatabase();
