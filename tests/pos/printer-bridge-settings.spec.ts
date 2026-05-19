import { beforeEach, describe, expect, it, vi } from "vitest";

const appMetaStore = new Map<string, string>();

vi.mock("@/lib/offline/db", () => ({
  offlineDb: {
    appMeta: {
      get: vi.fn(async (key: string) => {
        const value = appMetaStore.get(key);
        return value === undefined ? undefined : { key, value };
      }),
      put: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        appMetaStore.set(key, value);
      }),
    },
  },
}));

import {
  DEFAULT_PRINTER_BRIDGE_SETTINGS,
  loadPrinterBridgeSettings,
  savePrinterBridgeSettings,
} from "@/features/pos/lib/printer-bridge-settings";

describe("printer bridge settings", () => {
  beforeEach(() => {
    appMetaStore.clear();
  });

  it("loads default qz settings when storage empty", async () => {
    const settings = await loadPrinterBridgeSettings();
    expect(settings).toEqual(DEFAULT_PRINTER_BRIDGE_SETTINGS);
  });

  it("migrates legacy bridgeUrl to qz fields", async () => {
    appMetaStore.set("printer_bridge_url", "wss://127.0.0.1:9191/print");

    const settings = await loadPrinterBridgeSettings();
    expect(settings.qzHost).toBe("127.0.0.1");
    expect(settings.qzUseSecure).toBe(true);
    expect(settings.qzSecurePorts).toBe("9191");
  });

  it("rejects invalid qz ports", async () => {
    await expect(
      savePrinterBridgeSettings({
        ...DEFAULT_PRINTER_BRIDGE_SETTINGS,
        qzSecurePorts: "not-a-port",
      }),
    ).rejects.toThrow("Port WSS harus berisi daftar port valid");
  });

  it("requires cert and sign endpoint in server signing mode", async () => {
    await expect(
      savePrinterBridgeSettings({
        ...DEFAULT_PRINTER_BRIDGE_SETTINGS,
        qzSigningMode: "server",
        qzCertificatePem: "",
        qzSignEndpoint: "",
      }),
    ).rejects.toThrow("Certificate PEM wajib diisi jika mode signing aktif.");
  });

  it("requires private key in client signing mode", async () => {
    await expect(
      savePrinterBridgeSettings({
        ...DEFAULT_PRINTER_BRIDGE_SETTINGS,
        qzSigningMode: "client",
        qzCertificatePem: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
        qzClientPrivateKeyPem: "",
      }),
    ).rejects.toThrow("Private key PEM wajib diisi jika mode client signing aktif.");
  });
});
