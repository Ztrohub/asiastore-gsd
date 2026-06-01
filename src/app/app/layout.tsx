import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { AppNav } from "@/components/app/app-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { InventorySyncBootstrap } from "@/features/inventory/components/inventory-sync-bootstrap";
import { PosSyncBootstrap } from "@/features/pos/components/pos-sync-bootstrap";

const SIDEBAR_STATE_COOKIE = "sidebar_state";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const sidebarCookieValue = (await cookies()).get(SIDEBAR_STATE_COOKIE)?.value;
  const defaultSidebarOpen = sidebarCookieValue !== "false";

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <InventorySyncBootstrap />
      <PosSyncBootstrap />
      <Sidebar
        className="border-r border-border bg-card"
        collapsible="offcanvas"
        data-testid="app-shell-sidebar"
      >
        <div className="flex h-14 items-center border-b border-border px-4">
          <p className="text-sm font-semibold uppercase tracking-[0.15em]">Asiatek POS</p>
        </div>
        <SidebarContent className="p-4">
          <AppNav />
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div
            className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6 xl:px-8 2xl:px-10"
            data-testid="app-shell-header"
          >
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SidebarTrigger className="shrink-0" data-testid="app-shell-sidebar-trigger" />
              <p className="truncate text-sm font-semibold uppercase tracking-[0.15em]">
                Asiatek POS
              </p>
              <Badge className="hidden sm:inline-flex" variant="secondary">
                Offline-ready
              </Badge>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div
          className="flex w-full flex-1 px-4 py-4 md:px-6 xl:px-8 2xl:px-10"
          data-testid="app-shell-body"
        >
          <div className="min-w-0 flex-1" data-testid="app-shell-main">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
