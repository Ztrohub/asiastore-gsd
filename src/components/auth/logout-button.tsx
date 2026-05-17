"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { useConnectivity } from "@/hooks/use-connectivity";
import { offlineDb } from "@/lib/offline/db";
import { clearLocalSession } from "@/lib/session/offline-session";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { online } = useConnectivity();

  async function handleLogout() {
    setPending(true);
    try {
      await clearLocalSession();
      await offlineDb.appMeta.put({
        key: "logout_intent",
        value: String(Date.now()),
      });
      if (!online) {
        router.replace("/");
        return;
      }
      const result = await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
      });
      if (!result.ok) {
        throw new Error("Logout request failed");
      }
      await offlineDb.appMeta.delete("logout_intent");
      router.replace("/");
      router.refresh();
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
