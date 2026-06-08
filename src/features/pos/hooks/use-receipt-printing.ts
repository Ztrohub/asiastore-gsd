"use client";

import { useState } from "react";
import type { PosTransactionRecord } from "@/lib/offline/db";
import { printReceiptThroughBridge } from "@/features/pos/lib/print-bridge";
import { buildReceiptText } from "@/features/pos/lib/receipt-format";
import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";

export type ReceiptPromptVariant = "initial" | "copy-confirm";

export function useReceiptPrinting() {
  const [pendingTransaction, setPendingTransaction] = useState<PosTransactionRecord | null>(null);
  const [receiptPromptVariant, setReceiptPromptVariant] = useState<ReceiptPromptVariant>("initial");
  const [printError, setPrintError] = useState<string | null>(null);
  const [printStatusMessage, setPrintStatusMessage] = useState<string | null>(null);
  const [printStatusType, setPrintStatusType] = useState<"success" | "error" | null>(null);
  const [printing, setPrinting] = useState(false);

  function promptReceipt(transaction: PosTransactionRecord) {
    setPendingTransaction(transaction);
    setReceiptPromptVariant("initial");
    setPrintError(null);
    setPrintStatusMessage(null);
    setPrintStatusType(null);
  }

  function closePrompt() {
    setPendingTransaction(null);
    setReceiptPromptVariant("initial");
    setPrinting(false);
  }

  async function printOnceAndClose(settings: PrinterBridgeSettings) {
    if (!pendingTransaction) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const receiptText = buildReceiptText(settings, pendingTransaction);
      await printReceiptThroughBridge({ receiptText, settings });
      setPrintStatusType("success");
      setPrintStatusMessage("Perintah print berhasil dikirim.");
      const shouldAskForTransferCopy =
        receiptPromptVariant === "initial" && pendingTransaction.payment_method === "bank_transfer";
      if (shouldAskForTransferCopy) {
        setReceiptPromptVariant("copy-confirm");
        return;
      }
      setPendingTransaction(null);
      setReceiptPromptVariant("initial");
    } catch {
      setPrintError("Print gagal. Silakan cek printer.");
      setPrintStatusType("error");
      setPrintStatusMessage("Print gagal. Cek printer atau print bridge.");
    } finally {
      setPrinting(false);
    }
  }

  function clearPrintStatus() {
    setPrintStatusType(null);
    setPrintStatusMessage(null);
  }

  return {
    pendingTransaction,
    receiptPromptVariant,
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
