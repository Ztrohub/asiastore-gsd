import type { ReactNode } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";

function NavContent() {
  return (
    <nav className="space-y-2 text-sm">
      <Link className="block rounded-md bg-primary/10 px-3 py-2 font-medium" href="/app">
        Dashboard
      </Link>
      <p className="rounded-md px-3 py-2 text-muted-foreground">POS (phase berikutnya)</p>
      <p className="rounded-md px-3 py-2 text-muted-foreground">Inventori (phase berikutnya)</p>
    </nav>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
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
                  <NavContent />
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
          <NavContent />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
