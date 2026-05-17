import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NetworkStatusBadge } from "@/components/app/network-status-badge";
import { LogoutButton } from "@/components/auth/logout-button";
import { formatCurrencyIdr } from "@/features/format/currency";
import { formatJakartaDateTime } from "@/features/format/datetime";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db/prisma";
import { getReservedPosShortcutActions } from "@/lib/shortcuts/pos-contract";

export default async function AppShellPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = token ? decodeSession(token) : null;

  if (!session) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      username: true,
      role: true,
      isActive: true,
      passwordVersion: true,
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.passwordVersion !== session.passwordVersion ||
    user.role !== session.role ||
    user.username !== session.username
  ) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Status sesi</p>
          <h1 className="mt-1 text-2xl font-semibold">Selamat datang, {user.username}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Role: <span className="font-medium">{user.role}</span> | Login terakhir:{" "}
            {formatJakartaDateTime(new Date(session.issuedAt))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NetworkStatusBadge />
          <LogoutButton />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Target kas tunai</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrencyIdr(2500000)}</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Transaksi hari ini</p>
          <p className="mt-2 text-2xl font-semibold">0</p>
        </article>
        <article className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Sinkronisasi</p>
          <p className="mt-2 text-2xl font-semibold">Belum ada antrean</p>
        </article>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Kontrak shortcut POS (disiapkan)</p>
        <p className="mt-2 text-sm">{getReservedPosShortcutActions().join(", ")}</p>
      </section>
    </main>
  );
}
