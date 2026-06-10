import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";
import { useReceiptPrinting } from "@/features/pos/hooks/use-receipt-printing";
import type { PosTransactionRecord } from "@/lib/offline/db";

const printReceiptThroughBridgeMock = vi.fn();
const buildReceiptTextMock = vi.fn();

vi.mock("@/features/pos/lib/print-bridge", () => ({
  printReceiptThroughBridge: (payload: unknown) => printReceiptThroughBridgeMock(payload),
}));

vi.mock("@/features/pos/lib/receipt-format", () => ({
  buildReceiptText: (settings: unknown, transaction: unknown) =>
    buildReceiptTextMock(settings, transaction),
}));

const printerSettings: PrinterBridgeSettings = {
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

function buildTransaction(paymentMethod: "cash" | "bank_transfer"): PosTransactionRecord {
  return {
    id_transaksi: `tx-${paymentMethod}`,
    short_id: `SHORT-${paymentMethod}`,
    kasir_user_id: "cashier-1",
    kasir_username: "cashier",
    payment_method: paymentMethod,
    subtotal_amount: 20000,
    item_discount: 0,
    order_discount: 0,
    total_amount: 20000,
    amount_received: paymentMethod === "cash" ? 20000 : undefined,
    change_amount: paymentMethod === "cash" ? 0 : undefined,
    counts_for_cash: paymentMethod === "cash",
    note: "",
    lines: [
      {
        id_produk: "prod-1",
        nama_produk: "Produk 1",
        unit_price: 20000,
        qty: 1,
        unit_mutasi: "SMALL",
        unit_label: "pcs",
        line_discount: 0,
        line_total: 20000,
      },
    ],
    client_timestamp: 1,
    createdAt: 1,
  };
}

describe("useReceiptPrinting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildReceiptTextMock.mockReturnValue("RECEIPT TEXT");
    printReceiptThroughBridgeMock.mockResolvedValue(undefined);
  });

  it("keeps transfer transactions open for copy confirmation after the first successful print", async () => {
    const { result } = renderHook(() => useReceiptPrinting());
    const transferTransaction = buildTransaction("bank_transfer");

    act(() => {
      result.current.promptReceipt(transferTransaction);
    });

    await act(async () => {
      await result.current.printOnceAndClose(printerSettings);
    });

    expect(printReceiptThroughBridgeMock).toHaveBeenCalledTimes(1);
    expect(result.current.pendingTransaction).toEqual(transferTransaction);
    expect(result.current.receiptPromptVariant).toBe("copy-confirm");
    expect(result.current.printError).toBeNull();
  });

  it("prints the same transfer receipt a second time when copy confirmation is accepted", async () => {
    const { result } = renderHook(() => useReceiptPrinting());
    const transferTransaction = buildTransaction("bank_transfer");

    act(() => {
      result.current.promptReceipt(transferTransaction);
    });
    await act(async () => {
      await result.current.printOnceAndClose(printerSettings);
    });
    await act(async () => {
      await result.current.printOnceAndClose(printerSettings);
    });

    expect(buildReceiptTextMock).toHaveBeenCalledTimes(2);
    expect(printReceiptThroughBridgeMock).toHaveBeenCalledTimes(2);
    expect(printReceiptThroughBridgeMock).toHaveBeenNthCalledWith(1, {
      receiptText: "RECEIPT TEXT",
      settings: printerSettings,
    });
    expect(printReceiptThroughBridgeMock).toHaveBeenNthCalledWith(2, {
      receiptText: "RECEIPT TEXT",
      settings: printerSettings,
    });
    expect(result.current.pendingTransaction).toBeNull();
    expect(result.current.receiptPromptVariant).toBe("initial");
  });

  it("closes the copy confirmation without a second print when transfer copy is skipped", async () => {
    const { result } = renderHook(() => useReceiptPrinting());
    const transferTransaction = buildTransaction("bank_transfer");

    act(() => {
      result.current.promptReceipt(transferTransaction);
    });
    await act(async () => {
      await result.current.printOnceAndClose(printerSettings);
    });
    act(() => {
      result.current.closePrompt();
    });

    expect(printReceiptThroughBridgeMock).toHaveBeenCalledTimes(1);
    expect(result.current.pendingTransaction).toBeNull();
    expect(result.current.receiptPromptVariant).toBe("initial");
  });

  it("can reprint an existing history transaction without opening the receipt prompt state", async () => {
    const { result } = renderHook(() => useReceiptPrinting());
    const cashTransaction = buildTransaction("cash");

    await act(async () => {
      await result.current.printTransaction(printerSettings, cashTransaction);
    });

    expect(buildReceiptTextMock).toHaveBeenCalledWith(printerSettings, cashTransaction);
    expect(printReceiptThroughBridgeMock).toHaveBeenCalledWith({
      receiptText: "RECEIPT TEXT",
      settings: printerSettings,
    });
    expect(result.current.pendingTransaction).toBeNull();
    expect(result.current.printStatusType).toBe("success");
  });
});
