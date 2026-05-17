"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { offlineDb } from "@/lib/offline/db";
import { clearLocalSession } from "@/lib/session/offline-session";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await clearLocalSession();
      if (!navigator.onLine) {
        await offlineDb.appMeta.put({
          key: "logout_intent",
          value: String(Date.now()),
        });
        window.location.assign("/");
        return;
      }
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
      window.location.assign("/");
    } catch {
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      className={buttonVariants({ variant: "outline" })}
      disabled={pending}
      onClick={handleLogout}
      type="button"
    >
      {pending ? "Keluar..." : "Keluar"}
    </button>
  );
}
