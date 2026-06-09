import { formatJakartaDateTime } from "@/features/format/datetime";
import type { PosTransactionRecord } from "@/lib/offline/db";
import type { PrinterBridgeSettings } from "@/features/pos/lib/printer-bridge-settings";

const WIDTH = 32;

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

      for (let index = 0; index < word.length; index += width) {
        out.push(word.slice(index, index + width));
      }
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

function centeredWrappedLines(input: string, width = WIDTH) {
  return wrapLine(input, width).map((line) => centerLine(line, width));
}

function wrapLabelValue(label: string, value: string, width = WIDTH) {
  if (label.length + 1 + value.length <= width) {
    return [lineWithValue(label, value, width)];
  }

  return [...wrapLine(label, width), ...wrapLine(value, width).map((line) => line.padStart(width))];
}

function buildItemAmountLines(qty: number, unitPrice: number, lineTotal: number, width = WIDTH) {
  const compactLine = `${qty} x ${formatReceiptCurrencyIdr(unitPrice)} = ${formatReceiptCurrencyIdr(lineTotal)}`;
  if (compactLine.length <= width) {
    return [compactLine];
  }

  return [
    `${qty} x ${formatReceiptCurrencyIdr(unitPrice)}`,
    ...wrapLabelValue("Subtotal", formatReceiptCurrencyIdr(lineTotal), width),
  ];
}

export function buildReceiptText(settings: PrinterBridgeSettings, tx: PosTransactionRecord) {
  const lines: string[] = [];
  lines.push(...centeredWrappedLines(settings.storeName.toUpperCase()));
  lines.push(...centeredWrappedLines(settings.storeDescription));
  lines.push(`Waktu : ${formatJakartaDateTime(tx.client_timestamp)}`);
  lines.push(`Kasir : ${tx.kasir_username}`);

  for (const item of tx.lines) {
    lines.push(...wrapLine(item.nama_produk));
    lines.push(...buildItemAmountLines(item.qty, item.unit_price, item.line_total));
    if (item.line_discount > 0) {
      lines.push(...wrapLabelValue("Diskon item", formatReceiptCurrencyIdr(-item.line_discount)));
    }
  }

  lines.push("-".repeat(WIDTH));
  lines.push(...wrapLabelValue("Subtotal", formatReceiptCurrencyIdr(tx.subtotal_amount)));
  lines.push(
    ...wrapLabelValue(
      "Diskon Subtotal",
      formatReceiptCurrencyIdr(-(tx.item_discount + tx.order_discount)),
    ),
  );
  lines.push(...wrapLabelValue("TOTAL", formatReceiptCurrencyIdr(tx.total_amount)));
  lines.push(...wrapLabelValue("Pembayaran", tx.payment_method === "cash" ? "Tunai" : "Transfer"));
  if (tx.payment_method === "cash") {
    lines.push(
      ...wrapLabelValue(
        "Uang Diterima",
        formatReceiptCurrencyIdr(tx.amount_received ?? tx.total_amount),
      ),
    );
    lines.push(...wrapLabelValue("Kembalian", formatReceiptCurrencyIdr(tx.change_amount ?? 0)));
  }
  lines.push(`ID: ${tx.short_id}`);
  lines.push(...centeredWrappedLines(settings.footerMessage));
  return lines.join("\n");
}
