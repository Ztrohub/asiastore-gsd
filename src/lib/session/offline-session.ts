import { offlineDb } from "@/lib/offline/db";
import {
  isIdleExpired,
  mustReloginBySchedule,
  nextMondayReloginAt,
} from "@/lib/session/policy";

export type OfflineSessionInput = {
  userId: string;
  username: string;
  role: "OWNER" | "CASHIER";
  passwordVersion: number;
};

export async function persistLocalSession(input: OfflineSessionInput) {
  const now = Date.now();
  await offlineDb.localSessions.put({
    key: "active",
    userId: input.userId,
    username: input.username,
    role: input.role,
    passwordVersion: input.passwordVersion,
    lastActivityAt: now,
    mustReloginAt: nextMondayReloginAt(new Date(now)),
  });
}

export async function clearLocalSession() {
  await offlineDb.localSessions.delete("active");
}

export async function touchLocalSession() {
  const current = await offlineDb.localSessions.get("active");
  if (!current) return;
  await offlineDb.localSessions.update("active", { lastActivityAt: Date.now() });
}

export async function restoreLocalSession() {
  const current = await offlineDb.localSessions.get("active");
  if (!current) return null;

  if (isIdleExpired(current.lastActivityAt) || mustReloginBySchedule(current.mustReloginAt)) {
    await clearLocalSession();
    return null;
  }

  return current;
}
