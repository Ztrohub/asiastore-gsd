"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppNav() {
  const pathname = usePathname();
  const dashboardActive = pathname === "/app";
  const inventoryActive = pathname.startsWith("/app/inventory");
  const posActive = pathname.startsWith("/app/pos");
  const transactionsActive = pathname.startsWith("/app/transaksi");
  const queueActive = pathname.startsWith("/app/sync-queue");
  const printerActive = pathname.startsWith("/app/settings/printer");

  return (
    <nav className="space-y-2 text-sm">
      <Link
        className={cn(
          "block rounded-md px-3 py-2 hover:bg-muted",
          dashboardActive && "bg-primary/10 font-medium",
        )}
        href="/app"
      >
        Dashboard
      </Link>
      <Link
        className={cn(
          "block rounded-md px-3 py-2 hover:bg-muted",
          posActive && "bg-primary/10 font-medium",
        )}
        href="/app/pos"
      >
        POS
      </Link>
      <Link
        className={cn(
          "block rounded-md px-3 py-2 hover:bg-muted",
          transactionsActive && "bg-primary/10 font-medium",
        )}
        href="/app/transaksi"
      >
        Transaksi
      </Link>
      <Link
        className={cn(
          "block rounded-md px-3 py-2 hover:bg-muted",
          inventoryActive && "bg-primary/10 font-medium",
        )}
        href="/app/inventory"
      >
        Inventori
      </Link>
      <Link
        className={cn(
          "block rounded-md px-3 py-2 hover:bg-muted",
          queueActive && "bg-primary/10 font-medium",
        )}
        href="/app/sync-queue"
      >
        Queue Sync
      </Link>
      <Link
        className={cn(
          "block rounded-md px-3 py-2 hover:bg-muted",
          printerActive && "bg-primary/10 font-medium",
        )}
        href="/app/settings/printer"
      >
        Printer Bridge
      </Link>
    </nav>
  );
}
