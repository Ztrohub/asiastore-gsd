"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ServiceWorkerRegister } from "@/features/pwa/service-worker-register";
import { useConnectivity } from "@/hooks/use-connectivity";
import { encryptVerifier, decryptVerifier } from "@/lib/crypto/device-crypto";
import { offlineDb } from "@/lib/offline/db";
import { persistLocalSession } from "@/lib/session/offline-session";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineUsername, setOfflineUsername] = useState<string | null>(null);
  const [offlineFallbackNotice, setOfflineFallbackNotice] = useState<string | null>(null);
  const { online } = useConnectivity();

  useEffect(() => {
    let active = true;
    async function hydrateOfflineUsername() {
      if (online) {
        setOfflineUsername(null);
        setOfflineFallbackNotice(null);
        return;
      }
      const latest = await offlineDb.appMeta.get("last_online_username");
      if (!active) return;
      const locked = latest?.value?.trim() ?? "";
      if (locked) {
        setOfflineUsername(locked);
        setUsername(locked);
        setOfflineFallbackNotice(null);
      } else {
        setOfflineUsername(null);
      }
    }
    hydrateOfflineUsername().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [online]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const runOfflineLogin = async () => {
        let effectiveUsername = (offlineUsername ?? "").trim();
        if (!effectiveUsername) {
          const latestCached = await offlineDb.credentialCache.orderBy("updatedAt").last();
          effectiveUsername = latestCached?.username?.trim() ?? "";
          if (effectiveUsername) {
            setOfflineUsername(effectiveUsername);
            setUsername(effectiveUsername);
            setOfflineFallbackNotice(
              "Username offline dipilih otomatis dari cache terakhir. Silakan login online ulang bila tidak sesuai.",
            );
          }
        }
        if (!effectiveUsername) {
          throw new Error("Belum ada user online terakhir di perangkat ini.");
        }
        const cached = await offlineDb.credentialCache.get(effectiveUsername);
        if (!cached) {
          throw new Error("Akun ini belum pernah login online di perangkat ini.");
        }
        let decrypted: string;
        try {
          decrypted = await decryptVerifier({
            encryptedVerifier: cached.encryptedVerifier,
            password,
            salt: cached.salt,
            iv: cached.iv,
            iterations: cached.iterations,
          });
        } catch {
          throw new Error("Password offline tidak valid.");
        }
        if (decrypted !== password) {
          throw new Error("Password offline tidak valid.");
        }
        await persistLocalSession({
          userId: cached.userId ?? cached.username,
          username: cached.username,
          role: cached.role,
          passwordVersion: cached.passwordVersion,
        });
        await offlineDb.appMeta.delete("logout_intent");
        window.location.assign("/app");
        return;
      };

      if (!online) {
        await runOfflineLogin();
        return;
      }

      let response: Response;
      try {
        response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
      } catch {
        await runOfflineLogin();
        return;
      }

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

      await offlineDb.localSessions.delete("active");
      await offlineDb.appMeta.delete("logout_intent");
      await offlineDb.appMeta.put({
        key: "last_online_username",
        value: payload.user.username,
      });
      const encrypted = await encryptVerifier(password, password);
      await offlineDb.credentialCache.put({
        userId: payload.user.id,
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

      window.location.assign("/app");
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
              {!online && offlineUsername ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Mode offline: login hanya untuk user terakhir online (<b>{offlineUsername}</b>).
                </p>
              ) : null}
              {offlineFallbackNotice ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  {offlineFallbackNotice}
                </p>
              ) : null}
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
                    disabled={!online && !!offlineUsername}
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
