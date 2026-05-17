"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { clearLocalSession } from "@/lib/session/offline-session";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    try {
      await clearLocalSession();
      window.location.assign("/api/auth/logout");
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
