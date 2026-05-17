"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { offlineDb } from "@/lib/offline/db";

export function LogoutIntentFlusher() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

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
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [router]);

  return null;
}
