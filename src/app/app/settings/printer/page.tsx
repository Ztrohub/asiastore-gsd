"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrinterBridgeSettings } from "@/features/pos/hooks/use-printer-bridge-settings";
import { connectQzTray, listQzPrinters } from "@/features/pos/lib/qz-client";

export default function PrinterBridgeSettingsPage() {
  const { settings, setSettings, loading, saving, persist } = usePrinterBridgeSettings();
  const [message, setMessage] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedPrinters, setDetectedPrinters] = useState<string[]>([]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Memuat pengaturan QZ Tray...</p>;
  }

  return (
    <main className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Pengaturan QZ Tray</h1>
        <p className="text-sm text-muted-foreground">
          Semua pengaturan ini disimpan di client (browser/perangkat ini).
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <label className="space-y-1 text-sm">
          <span>QZ Host</span>
          <Input
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, qzHost: event.target.value }))
            }
            placeholder="localhost"
            value={settings.qzHost}
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            checked={settings.qzUseSecure}
            className="h-4 w-4"
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, qzUseSecure: event.target.checked }))
            }
            type="checkbox"
          />
          <span>Gunakan WSS</span>
        </label>

        <label className="space-y-1 text-sm">
          <span>Port WSS (comma-separated)</span>
          <Input
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, qzSecurePorts: event.target.value }))
            }
            placeholder="8181,8282,8383,8484"
            value={settings.qzSecurePorts}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Port WS (comma-separated)</span>
          <Input
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, qzInsecurePorts: event.target.value }))
            }
            placeholder="8182,8283,8384,8485"
            value={settings.qzInsecurePorts}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Nama Printer (opsional, kosong = default OS)</span>
          <Input
            list="qz-printer-list"
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, qzPrinterName: event.target.value }))
            }
            placeholder="Contoh: EPSON TM-T82 Receipt"
            value={settings.qzPrinterName}
          />
          <datalist id="qz-printer-list">
            {detectedPrinters.map((printer) => (
              <option key={printer} value={printer} />
            ))}
          </datalist>
        </label>

        <label className="space-y-1 text-sm">
          <span>Mode Signing</span>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                qzSigningMode: event.target.value as "unsigned" | "server" | "client",
              }))
            }
            value={settings.qzSigningMode}
          >
            <option value="unsigned">Unsigned (offline mudah, popup warning bisa muncul)</option>
            <option value="client">Client-Side Signing (offline, key disimpan di appMeta)</option>
            <option value="server">Server-Side Signing (lebih aman, butuh sign endpoint)</option>
          </select>
        </label>

        {settings.qzSigningMode !== "unsigned" ? (
          <>
            <label className="space-y-1 text-sm">
              <span>Certificate PEM</span>
              <textarea
                className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, qzCertificatePem: event.target.value }))
                }
                placeholder="-----BEGIN CERTIFICATE-----"
                value={settings.qzCertificatePem}
              />
            </label>
          </>
        ) : null}

        {settings.qzSigningMode === "server" ? (
          <label className="space-y-1 text-sm">
            <span>Sign Endpoint</span>
            <Input
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, qzSignEndpoint: event.target.value }))
              }
              placeholder="https://your-api/sign-qz"
              value={settings.qzSignEndpoint}
            />
          </label>
        ) : null}

        {settings.qzSigningMode === "client" ? (
          <label className="space-y-1 text-sm">
            <span>Private Key PEM (tersimpan di appMeta local device)</span>
            <textarea
              className="h-40 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, qzClientPrivateKeyPem: event.target.value }))
              }
              placeholder="-----BEGIN PRIVATE KEY-----"
              value={settings.qzClientPrivateKeyPem}
            />
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Risiko keamanan: private key berada di client/browser kasir ini.
            </p>
          </label>
        ) : null}

        <label className="space-y-1 text-sm">
          <span>Nama Toko</span>
          <Input
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, storeName: event.target.value }))
            }
            value={settings.storeName}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Deskripsi Toko</span>
          <Input
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, storeDescription: event.target.value }))
            }
            value={settings.storeDescription}
          />
        </label>

        <label className="space-y-1 text-sm">
          <span>Footer Receipt</span>
          <textarea
            className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) =>
              setSettings((prev) => ({ ...prev, footerMessage: event.target.value }))
            }
            value={settings.footerMessage}
          />
        </label>

        <div className="flex items-center gap-2">
          <Button
            disabled={testing || detecting}
            onClick={async () => {
              setMessage(null);
              setTesting(true);
              try {
                const { qz, disconnectIfNeeded } = await connectQzTray(settings);
                try {
                  const info = await qz.websocket.getConnectionInfo();
                  setMessage(`QZ terkoneksi: ${info.host}:${info.port}`);
                } finally {
                  await disconnectIfNeeded();
                }
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "Gagal koneksi ke QZ Tray.");
              } finally {
                setTesting(false);
              }
            }}
            type="button"
            variant="secondary"
          >
            {testing ? "Testing..." : "Test Koneksi QZ"}
          </Button>

          <Button
            disabled={testing || detecting}
            onClick={async () => {
              setMessage(null);
              setDetecting(true);
              try {
                const { qz, disconnectIfNeeded } = await connectQzTray(settings);
                try {
                  const printers = await listQzPrinters(qz);
                  setDetectedPrinters(printers);
                  if (printers.length === 0) {
                    setMessage("QZ terkoneksi, tapi printer tidak ditemukan.");
                  } else {
                    setMessage(`Printer terdeteksi: ${printers.length} item.`);
                    if (!settings.qzPrinterName.trim()) {
                      setSettings((prev) => ({ ...prev, qzPrinterName: printers[0] }));
                    }
                  }
                } finally {
                  await disconnectIfNeeded();
                }
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "Gagal mendeteksi printer.");
              } finally {
                setDetecting(false);
              }
            }}
            type="button"
            variant="outline"
          >
            {detecting ? "Detecting..." : "Deteksi Printer"}
          </Button>

          <Button
            disabled={saving}
            onClick={async () => {
              try {
                await persist(settings);
                setMessage("Pengaturan QZ Tray tersimpan di client.");
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "Gagal menyimpan setting.");
              }
            }}
            type="button"
          >
            {saving ? "Menyimpan..." : "Simpan Pengaturan QZ"}
          </Button>
          {message ? <p className="text-sm">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
