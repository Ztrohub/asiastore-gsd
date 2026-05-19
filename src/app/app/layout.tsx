import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/app/app-nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { InventorySyncBootstrap } from "@/features/inventory/components/inventory-sync-bootstrap";
import { PosSyncBootstrap } from "@/features/pos/components/pos-sync-bootstrap";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <InventorySyncBootstrap />
      <PosSyncBootstrap />
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger
                render={<Button className="md:hidden" size="icon" variant="outline" />}
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Asiatek POS</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <AppNav />
                </div>
              </SheetContent>
            </Sheet>
            <p className="text-sm font-semibold uppercase tracking-[0.15em]">Asiatek POS</p>
            <Badge variant="secondary">Offline-ready</Badge>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[240px_1fr] md:px-6 lg:px-8">
        <aside className="hidden rounded-xl border border-border bg-card p-4 md:block">
          <AppNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
