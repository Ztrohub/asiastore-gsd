"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AppNav() {
  const pathname = usePathname();
  const dashboardActive = pathname === "/app";
  const inventoryActive = pathname.startsWith("/app/inventory");

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
      <p className="rounded-md px-3 py-2 text-muted-foreground">POS (phase berikutnya)</p>
      <Link
        className={cn(
          "block rounded-md px-3 py-2 hover:bg-muted",
          inventoryActive && "bg-primary/10 font-medium",
        )}
        href="/app/inventory"
      >
        Inventori
      </Link>
    </nav>
  );
}
