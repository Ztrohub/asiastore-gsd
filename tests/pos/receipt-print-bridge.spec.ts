import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";

const connectQzTrayMock = vi.fn();
const resolveQzPrinterNameMock = vi.fn();

vi.mock("@/features/pos/lib/qz-client", () => ({
  connectQzTray: (settings: unknown) => connectQzTrayMock(settings),
  resolveQzPrinterName: (qz: unknown, settings: unknown) =>
    resolveQzPrinterNameMock(qz, settings),
}));

import { printReceiptThroughBridge } from "@/features/pos/lib/print-bridge";

const baseSettings: PrinterBridgeSettings = {
  qzHost: "localhost",
  qzUseSecure: true,
  qzSecurePorts: "8181,8282",
  qzInsecurePorts: "8182,8283",
  qzPrinterName: "",
  qzSigningMode: "unsigned",
  qzCertificatePem: "",
  qzSignEndpoint: "",
  qzClientPrivateKeyPem: "",
  storeName: "ASIATEK POS",
  storeDescription: "Toko",
  footerMessage: "Terima kasih",
};

describe("receipt print bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends exactly one qz print request per print action", async () => {
    const printMock = vi.fn().mockResolvedValue(undefined);
    const createMock = vi.fn().mockReturnValue({ printer: "Printer A" });
    const disconnectIfNeededMock = vi.fn().mockResolvedValue(undefined);
    const qzMock = {
      configs: { create: createMock },
      print: printMock,
    };

    connectQzTrayMock.mockResolvedValue({
      qz: qzMock,
      disconnectIfNeeded: disconnectIfNeededMock,
    });
    resolveQzPrinterNameMock.mockResolvedValue("Printer A");

    await printReceiptThroughBridge({
      receiptText: "hello",
      settings: baseSettings,
    });

    expect(printMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith("Printer A", {
      jobName: "POS Receipt",
      encoding: "CP437",
      forceRaw: true,
    });
    expect(disconnectIfNeededMock).toHaveBeenCalledTimes(1);
  });

  it("throws error for empty receipt payload", async () => {
    await expect(
      printReceiptThroughBridge({
        receiptText: "   ",
        settings: baseSettings,
      }),
    ).rejects.toThrow("Receipt kosong.");
  });

  it("still disconnects when qz.print throws", async () => {
    const printMock = vi.fn().mockRejectedValue(new Error("gagal print"));
    const disconnectIfNeededMock = vi.fn().mockResolvedValue(undefined);
    const qzMock = {
      configs: { create: vi.fn().mockReturnValue({}) },
      print: printMock,
    };

    connectQzTrayMock.mockResolvedValue({
      qz: qzMock,
      disconnectIfNeeded: disconnectIfNeededMock,
    });
    resolveQzPrinterNameMock.mockResolvedValue("Printer A");

    await expect(
      printReceiptThroughBridge({
        receiptText: "hello",
        settings: baseSettings,
      }),
    ).rejects.toThrow("gagal print");

    expect(disconnectIfNeededMock).toHaveBeenCalledTimes(1);
  });
});
