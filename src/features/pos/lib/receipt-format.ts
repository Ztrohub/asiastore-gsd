import { formatJakartaDateTime } from "@/features/format/datetime";
import type { PosTransactionRecord } from "@/lib/offline/db";
import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";

const WIDTH = 32;
const ITEM_NAME_WIDTH = 18;
const ITEM_DETAIL_WIDTH = 13;

function wrapLine(input: string, width = WIDTH) {
  const out: string[] = [];
  const words = input.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return out;
  }

  let current = "";
  for (const word of words) {
    if (word.length > width) {
      if (current) {
        out.push(current);
        current = "";
      }

      let index = 0;
      while (index + width < word.length) {
        out.push(word.slice(index, index + width));
        index += width;
      }

      current = word.slice(index);
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }

    out.push(current);
    current = word;
  }

  if (current) {
    out.push(current);
  }

  return out;
}

function centerLine(input: string, width = WIDTH) {
  const value = input.trim();
  if (value.length >= width) return value;
  const pad = Math.floor((width - value.length) / 2);
  return `${" ".repeat(pad)}${value}`;
}

function formatReceiptCurrencyIdr(value: number) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "-" : ""}Rp ${grouped}`;
}

function lineWithValue(label: string, value: string, width = WIDTH) {
  const gap = Math.max(1, width - label.length - value.length);
  return `${label}${" ".repeat(gap)}${value}`;
}

function padEndReceipt(value: string, width: number) {
  if (value.length >= width) {
    return value;
  }

  return `${value}${" ".repeat(width - value.length)}`;
}

function formatCompactReceiptNumber(value: number) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "-" : ""}${grouped}`;
}

function buildItemDetailLines(qty: number, unitPrice: number, lineTotal: number, lineDiscount: number) {
  const detailLines = [`${qty} x ${formatCompactReceiptNumber(unitPrice)}`];

  if (lineDiscount > 0) {
    detailLines.push(`Disc ${formatCompactReceiptNumber(-lineDiscount)}`);
  }

  detailLines.push(`Sub ${formatCompactReceiptNumber(lineTotal)}`);

  return detailLines;
}

function combineReceiptColumns(leftLines: string[], rightLines: string[]) {
  const rowCount = Math.max(leftLines.length, rightLines.length);
  const rows: string[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const left = padEndReceipt(leftLines[index] ?? "", ITEM_NAME_WIDTH);
    const right = (rightLines[index] ?? "").padStart(ITEM_DETAIL_WIDTH);
    rows.push(`${left} ${right}`);
  }

  return rows;
}

export function buildReceiptText(settings: PrinterBridgeSettings, tx: PosTransactionRecord) {
  const lines: string[] = [];
  lines.push("=".repeat(WIDTH));
  lines.push(centerLine(settings.storeName.toUpperCase()));
  lines.push(centerLine(settings.storeDescription));
  lines.push("=".repeat(WIDTH));
  lines.push(`Waktu : ${formatJakartaDateTime(tx.client_timestamp)}`);
  lines.push(`Kasir : ${tx.kasir_username}`);
  lines.push("-".repeat(WIDTH));

  for (const item of tx.lines) {
    lines.push(
      ...combineReceiptColumns(
        wrapLine(item.nama_produk, ITEM_NAME_WIDTH),
        buildItemDetailLines(item.qty, item.unit_price, item.line_total, item.line_discount),
      ),
    );
    lines.push("-".repeat(WIDTH));
  }

  lines.push(lineWithValue("Subtotal", formatReceiptCurrencyIdr(tx.subtotal_amount)));
  lines.push(
    lineWithValue(
      "Diskon Subtotal",
      formatReceiptCurrencyIdr(-(tx.item_discount + tx.order_discount)),
    ),
  );
  lines.push(lineWithValue("TOTAL", formatReceiptCurrencyIdr(tx.total_amount)));
  lines.push(lineWithValue("Pembayaran", tx.payment_method === "cash" ? "Tunai" : "Transfer"));
  if (tx.payment_method === "cash") {
    lines.push(
      lineWithValue(
        "Uang Diterima",
        formatReceiptCurrencyIdr(tx.amount_received ?? tx.total_amount),
      ),
    );
    lines.push(lineWithValue("Kembalian", formatReceiptCurrencyIdr(tx.change_amount ?? 0)));
  }
  lines.push("-".repeat(WIDTH));
  lines.push(`ID: ${tx.short_id}`);
  lines.push(centerLine(settings.footerMessage));
  lines.push("=".repeat(WIDTH));
  return lines.join("\n");
}
