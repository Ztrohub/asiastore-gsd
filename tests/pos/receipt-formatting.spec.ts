import { describe, expect, it } from "vitest";
import { buildReceiptText } from "@/features/pos/lib/receipt-format";

const WIDTH = 32;
const fixedTimestamp = Date.UTC(2026, 4, 19, 3, 4, 5);

const settings = {
  qzHost: "localhost",
  qzUseSecure: true,
  qzSecurePorts: "8181,8282",
  qzInsecurePorts: "8182,8283",
  qzPrinterName: "",
  qzSigningMode: "unsigned" as const,
  qzCertificatePem: "",
  qzSignEndpoint: "",
  qzClientPrivateKeyPem: "",
  storeName: "Asiatek POS",
  storeDescription: "Toko Serba Ada",
  footerMessage: "Terima kasih sudah berbelanja di Asiatek POS.",
};

const cashTransaction = {
  id_transaksi: "id-1",
  short_id: "TRX-20260519-00001",
  kasir_user_id: "u1",
  kasir_username: "kasir-a",
  payment_method: "cash" as const,
  subtotal_amount: 20000,
  item_discount: 1000,
  order_discount: 500,
  total_amount: 18500,
  amount_received: 20000,
  change_amount: 1500,
  counts_for_cash: true,
  note: "internal note",
  client_timestamp: fixedTimestamp,
  createdAt: fixedTimestamp,
  lines: [
    {
      id_produk: "p1",
      nama_produk: "Nama Produk Sangat Panjang Sekali Sampai Wrap",
      unit_price: 10000,
      qty: 2,
      line_discount: 1000,
      line_total: 19000,
    },
  ],
};

function wrapLineLegacy(input: string, width = WIDTH) {
  const out: string[] = [];
  let remain = input.trim();
  while (remain.length > width) {
    out.push(remain.slice(0, width));
    remain = remain.slice(width).trimStart();
  }
  if (remain.length > 0) out.push(remain);
  return out;
}

function centerLineLegacy(input: string, width = WIDTH) {
  const value = input.trim();
  if (value.length >= width) return value;
  const pad = Math.floor((width - value.length) / 2);
  return `${" ".repeat(pad)}${value}`;
}

function formatCurrencyLegacy(value: number) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  const grouped = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${rounded < 0 ? "-" : ""}Rp ${grouped}`;
}

function lineWithValueLegacy(label: string, value: string, width = WIDTH) {
  const gap = Math.max(1, width - label.length - value.length);
  return `${label}${" ".repeat(gap)}${value}`;
}

function buildLegacyReceiptText() {
  const lines: string[] = [];
  lines.push("=".repeat(WIDTH));
  lines.push(centerLineLegacy(settings.storeName.toUpperCase()));
  lines.push(centerLineLegacy(settings.storeDescription));
  lines.push("=".repeat(WIDTH));
  lines.push("Waktu : 19-05-2026 10:04:05");
  lines.push(`Kasir : ${cashTransaction.kasir_username}`);
  lines.push("-".repeat(WIDTH));

  for (const item of cashTransaction.lines) {
    lines.push(...wrapLineLegacy(item.nama_produk));
    lines.push(`${item.qty} x ${formatCurrencyLegacy(item.unit_price)}`);
    if (item.line_discount > 0) {
      lines.push(`Diskon: ${formatCurrencyLegacy(-item.line_discount)}`);
    }
    lines.push(`Subtotal: ${formatCurrencyLegacy(item.line_total)}`);
    lines.push("-".repeat(WIDTH));
  }

  lines.push(lineWithValueLegacy("Subtotal", formatCurrencyLegacy(cashTransaction.subtotal_amount)));
  lines.push(
    lineWithValueLegacy(
      "Diskon Subtotal",
      formatCurrencyLegacy(-(cashTransaction.item_discount + cashTransaction.order_discount)),
    ),
  );
  lines.push(lineWithValueLegacy("TOTAL", formatCurrencyLegacy(cashTransaction.total_amount)));
  lines.push(lineWithValueLegacy("Pembayaran", "Tunai"));
  lines.push(
    lineWithValueLegacy("Uang Diterima", formatCurrencyLegacy(cashTransaction.amount_received)),
  );
  lines.push(lineWithValueLegacy("Kembalian", formatCurrencyLegacy(cashTransaction.change_amount)));
  lines.push("-".repeat(WIDTH));
  lines.push(`ID: ${cashTransaction.short_id}`);
  lines.push(centerLineLegacy(settings.footerMessage));
  lines.push("=".repeat(WIDTH));
  return lines.join("\n");
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

describe("receipt formatting", () => {
  it("includes required receipt fields and excludes internal note", () => {
    const text = buildReceiptText(settings, cashTransaction);
    expect(text).toContain("ASIATEK POS");
    expect(text).toContain("Toko Serba Ada");
    expect(text).toContain("TRX-20260519-00001");
    expect(text).toContain("2 x");
    expect(text).toContain("Subtotal");
    expect(text).toContain("Diskon Subtotal");
    expect(text).toContain("TOTAL");
    expect(text).toContain("Pembayaran");
    expect(text).toContain("Kasir : kasir-a");
    expect(text).toContain("Terima kasih");
    expect(text).not.toContain("internal note");
  });

  it("keeps all receipt fields while making the printed output much shorter", () => {
    const legacyText = buildLegacyReceiptText();
    const compactText = buildReceiptText(settings, cashTransaction);

    expect(normalizeText(compactText)).toContain(cashTransaction.lines[0].nama_produk);
    expect(normalizeText(compactText)).toContain(settings.footerMessage);
    expect(compactText).toContain("Waktu");
    expect(compactText).toContain("Kasir");
    expect(compactText).toContain("Diskon");
    expect(compactText).toContain("TOTAL");
    expect(compactText).toContain("Pembayaran");
    expect(compactText).toContain("Uang Diterima");
    expect(compactText).toContain("Kembalian");
    expect(compactText).toContain(cashTransaction.short_id);

    const legacyLines = legacyText.split("\n");
    const compactLines = compactText.split("\n");

    expect(compactLines.length).toBeLessThanOrEqual(legacyLines.length - 4);
    expect(compactLines.every((line) => line.length <= WIDTH)).toBe(true);
  });
});
