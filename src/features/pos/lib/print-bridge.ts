import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";
import { connectQzTray, resolveQzPrinterName } from "@/features/pos/lib/qz-client";

type PrintBridgePayload = {
  receiptText: string;
  settings: PrinterBridgeSettings;
};

const ESC = "\x1B";
const GS = "\x1D";
const INIT = `${ESC}@`;
const ALIGN_LEFT = `${ESC}a\x00`;
const ALIGN_CENTER = `${ESC}a\x01`;
const BOLD_ON = `${ESC}E\x01`;
const BOLD_OFF = `${ESC}E\x00`;
const SIZE_NORMAL = `${GS}!\x00`;
const SIZE_DOUBLE = `${GS}!\x11`;
const SIZE_DOUBLE_HEIGHT = `${GS}!\x01`;
const LINE_SPACING_SLIGHTLY_WIDER = `${ESC}3\x22`; // 34 dots
const LINE_SPACING_DEFAULT = `${ESC}2`;
const CUT_PAPER = `${GS}V\x00`;

function normalizeAsciiForThermal(input: string) {
  return input
    .replace(/\u00A0/g, " ")
    .replace(/[^\x0A\x0D\x20-\x7E]/g, "");
}

function buildEscPosReceipt(receiptText: string) {
  const lines = normalizeAsciiForThermal(receiptText).split("\n");
  const out: string[] = [INIT, LINE_SPACING_SLIGHTLY_WIDER, ALIGN_LEFT, SIZE_NORMAL];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      out.push("\n");
      continue;
    }

    if (trimmed.startsWith("=") || trimmed.startsWith("-")) {
      out.push(ALIGN_LEFT, SIZE_NORMAL, BOLD_OFF, `${line}\n`);
      continue;
    }

    if (trimmed === "TOTAL" || trimmed.startsWith("TOTAL ")) {
      out.push(ALIGN_LEFT, BOLD_ON, SIZE_DOUBLE_HEIGHT, `${line}\n`, SIZE_NORMAL, BOLD_OFF);
      continue;
    }

    if (index === 1) {
      out.push(ALIGN_CENTER, BOLD_ON, SIZE_DOUBLE, `${trimmed}\n`, SIZE_NORMAL, BOLD_OFF, ALIGN_LEFT);
      continue;
    }

    out.push(ALIGN_LEFT, SIZE_NORMAL, BOLD_OFF, `${line}\n`);
  }

  out.push("\n", LINE_SPACING_DEFAULT, CUT_PAPER);
  return out.join("");
}

export async function printReceiptThroughBridge(payload: PrintBridgePayload) {
  const receiptText = payload.receiptText.trim();
  if (!receiptText) {
    throw new Error("Receipt kosong.");
  }

  const { qz, disconnectIfNeeded } = await connectQzTray(payload.settings);

  try {
    const printerName = await resolveQzPrinterName(qz, payload.settings);
    const config = qz.configs.create(printerName, {
      jobName: "POS Receipt",
      encoding: "CP437",
      forceRaw: true,
    });
    const escPosData = buildEscPosReceipt(receiptText);
    await qz.print(config, [
      {
        type: "raw",
        format: "command",
        flavor: "plain",
        data: escPosData,
      },
    ]);
  } finally {
    await disconnectIfNeeded();
  }
}
