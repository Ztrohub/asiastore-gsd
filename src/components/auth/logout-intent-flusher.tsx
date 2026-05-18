"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { offlineDb } from "@/lib/offline/db";

const LOGOUT_INTENT_FLUSH_POLL_MS = 30_000;

export function LogoutIntentFlusher() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const INTENT_EXPIRY_MS = 15 * 60 * 1000;

    async function flushIfNeeded() {
      if (!navigator.onLine || cancelled) {
        return;
      }
      const pending = await offlineDb.appMeta.get("logout_intent");
      if (!pending || cancelled) {
        return;
      }
      const logoutIntentAt = Number(pending.value || "0");
      const activeSession = await offlineDb.localSessions.get("active");
      if (activeSession && activeSession.lastActivityAt > logoutIntentAt) {
        await offlineDb.appMeta.delete("logout_intent");
        return;
      }

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) {
        if (Date.now() - logoutIntentAt > INTENT_EXPIRY_MS) {
          await offlineDb.appMeta.delete("logout_intent");
        }
        return;
      }

      await offlineDb.appMeta.delete("logout_intent");
      if (cancelled) {
        return;
      }
      router.replace("/");
      router.refresh();
    }

    const onOnline = () => {
      flushIfNeeded().catch(() => undefined);
    };

    flushIfNeeded().catch(() => undefined);
    window.addEventListener("online", onOnline);
    const timer = window.setInterval(() => {
      flushIfNeeded().catch(() => undefined);
    }, LOGOUT_INTENT_FLUSH_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return null;
}
