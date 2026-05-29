import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";

const connectMock = vi.fn();
const disconnectMock = vi.fn();
const isActiveMock = vi.fn();
const setCertificatePromiseMock = vi.fn();
const setSignaturePromiseMock = vi.fn();
const setSignatureAlgorithmMock = vi.fn();

vi.mock("qz-tray", () => ({
  default: {
    security: {
      setCertificatePromise: setCertificatePromiseMock,
      setSignaturePromise: setSignaturePromiseMock,
      setSignatureAlgorithm: setSignatureAlgorithmMock,
    },
    websocket: {
      connect: connectMock,
      disconnect: disconnectMock,
      isActive: isActiveMock,
    },
  },
}));

const baseSettings: PrinterBridgeSettings = {
  qzHost: "localhost",
  qzUseSecure: true,
  qzSecurePorts: "8181,8282,8383,8484",
  qzInsecurePorts: "8182,8283,8384,8485",
  qzPrinterName: "",
  qzSigningMode: "unsigned",
  qzCertificatePem: "",
  qzSignEndpoint: "",
  qzClientPrivateKeyPem: "",
  storeName: "ASIATEK POS",
  storeDescription: "Terima kasih sudah berbelanja",
  footerMessage: "Simpan struk ini sebagai bukti pembelian.",
};

describe("qz client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    connectMock.mockResolvedValue(undefined);
    disconnectMock.mockResolvedValue(undefined);
    isActiveMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows insecure websocket setting even when webapp runs on https", async () => {
    vi.stubGlobal(
      "window",
      {
        location: { protocol: "https:" },
      } as Window & typeof globalThis,
    );

    const { connectQzTray } = await import("@/features/pos/lib/qz-client");

    await expect(
      connectQzTray({
        ...baseSettings,
        qzUseSecure: false,
      }),
    ).resolves.toMatchObject({
      disconnectIfNeeded: expect.any(Function),
      qz: expect.any(Object),
    });

    expect(connectMock).toHaveBeenCalledWith({
      delay: 0,
      host: "localhost",
      port: {
        insecure: [8182, 8283, 8384, 8485],
        secure: [8181, 8282, 8383, 8484],
      },
      retries: 0,
      usingSecure: false,
    });
  });
});
