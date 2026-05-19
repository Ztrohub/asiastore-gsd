"use client";

import { useState } from "react";
import type { PosTransactionRecord } from "@/lib/offline/db";
import { printReceiptThroughBridge } from "@/features/pos/lib/print-bridge";
import { buildReceiptText } from "@/features/pos/lib/receipt-format";
import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";

export function useReceiptPrinting() {
  const [pendingTransaction, setPendingTransaction] = useState<PosTransactionRecord | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printStatusMessage, setPrintStatusMessage] = useState<string | null>(null);
  const [printStatusType, setPrintStatusType] = useState<"success" | "error" | null>(null);
  const [printing, setPrinting] = useState(false);

  function promptReceipt(transaction: PosTransactionRecord) {
    setPendingTransaction(transaction);
    setPrintError(null);
    setPrintStatusMessage(null);
    setPrintStatusType(null);
  }

  function closePrompt() {
    setPendingTransaction(null);
    setPrinting(false);
  }

  async function printOnceAndClose(settings: PrinterBridgeSettings) {
    if (!pendingTransaction) return;
    setPrinting(true);
    try {
      const receiptText = buildReceiptText(settings, pendingTransaction);
      await printReceiptThroughBridge({ receiptText, settings });
      setPrintStatusType("success");
      setPrintStatusMessage("Perintah print berhasil dikirim.");
    } catch {
      setPrintError("Print gagal. Silakan cek printer.");
      setPrintStatusType("error");
      setPrintStatusMessage("Print gagal. Cek printer atau print bridge.");
    } finally {
      setPendingTransaction(null);
      setPrinting(false);
    }
  }

  function clearPrintStatus() {
    setPrintStatusType(null);
    setPrintStatusMessage(null);
  }

  return {
    pendingTransaction,
    promptReceipt,
    closePrompt,
    printOnceAndClose,
    printing,
    printError,
    printStatusMessage,
    printStatusType,
    clearPrintStatus,
  };
}
