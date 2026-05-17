"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoonStar, SunMedium } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceWorkerRegister } from "@/features/pwa/service-worker-register";
import { encryptVerifier, decryptVerifier } from "@/lib/crypto/device-crypto";
import { offlineDb } from "@/lib/offline/db";
import { persistLocalSession, restoreLocalSession } from "@/lib/session/offline-session";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!navigator.onLine) {
        const cached = await offlineDb.credentialCache.get(username);
        if (!cached) {
          throw new Error("Akun ini belum pernah login online di perangkat ini.");
        }
        const decrypted = await decryptVerifier({
          encryptedVerifier: cached.encryptedVerifier,
          password,
          salt: cached.salt,
          iv: cached.iv,
          iterations: cached.iterations,
        });
        if (decrypted !== password) {
          throw new Error("Password offline tidak valid.");
        }
        const local = await restoreLocalSession();
        if (!local || local.username !== username) {
          throw new Error("Sesi lokal tidak valid. Silakan login online.");
        }
        router.push("/app");
        router.refresh();
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        user?: {
          id: string;
          username: string;
          role: "OWNER" | "CASHIER";
          passwordVersion: number;
        };
      };
      if (!response.ok || !payload.ok || !payload.user) {
        throw new Error(payload.message ?? "Login gagal.");
      }

      const encrypted = await encryptVerifier(password, password);
      await offlineDb.credentialCache.put({
        username: payload.user.username,
        encryptedVerifier: encrypted.encryptedVerifier,
        salt: encrypted.salt,
        iv: encrypted.iv,
        iterations: encrypted.iterations,
        passwordVersion: payload.user.passwordVersion,
        role: payload.user.role,
        updatedAt: Date.now(),
      });
      await persistLocalSession({
        userId: payload.user.id,
        username: payload.user.username,
        role: payload.user.role,
        passwordVersion: payload.user.passwordVersion,
      });

      router.push("/app");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login gagal.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <ServiceWorkerRegister />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(11,110,79,0.17),transparent_42%),radial-gradient(circle_at_80%_0%,rgba(52,211,153,0.23),transparent_30%),linear-gradient(to_bottom_right,transparent,rgba(15,23,42,0.05))]" />
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-5xl rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur">
        <div className="grid md:grid-cols-[1.2fr_1fr]">
          <section className="hidden rounded-l-2xl border-r border-border bg-sidebar p-10 text-sidebar-foreground md:flex md:flex-col md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Asiatek POS
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight">
                Operasional kasir cepat, tetap aman saat offline.
              </h1>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <SunMedium className="size-4" />
                Light theme siap untuk area kasir terang
              </p>
              <p className="flex items-center gap-2">
                <MoonStar className="size-4" />
                Dark theme siap untuk operasional malam
              </p>
            </div>
          </section>
          <section className="p-6 sm:p-10">
            <div className="mx-auto w-full max-w-md">
              <h2 className="text-2xl font-semibold">Masuk ke sistem</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Login online pertama wajib agar akun bisa dipakai ulang saat offline.
              </p>
              <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="username">
                    Username
                  </label>
                  <Input
                    id="username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="contoh: owner"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Masukkan password"
                    required
                  />
                </div>
                {error ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}
                <Button className="w-full" disabled={loading} type="submit">
                  {loading ? "Memproses..." : "Masuk"}
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
