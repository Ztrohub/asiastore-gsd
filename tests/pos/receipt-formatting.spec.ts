import { describe, expect, it } from "vitest";
import { buildReceiptText } from "@/features/pos/lib/receipt-format";

describe("receipt formatting", () => {
  it("includes required receipt fields and excludes internal note", () => {
    const text = buildReceiptText(
      {
        qzHost: "localhost",
        qzUseSecure: true,
        qzSecurePorts: "8181,8282",
        qzInsecurePorts: "8182,8283",
        qzPrinterName: "",
        qzSigningMode: "unsigned",
        qzCertificatePem: "",
        qzSignEndpoint: "",
        qzClientPrivateKeyPem: "",
        storeName: "Asiatek POS",
        storeDescription: "Toko Serba Ada",
        footerMessage: "Terima kasih",
      },
      {
      id_transaksi: "id-1",
      short_id: "TRX-20260519-00001",
      kasir_user_id: "u1",
      kasir_username: "kasir-a",
      payment_method: "cash",
      subtotal_amount: 20000,
      item_discount: 1000,
      order_discount: 500,
      total_amount: 18500,
      amount_received: 20000,
      change_amount: 1500,
      counts_for_cash: true,
      note: "internal note",
      client_timestamp: Date.now(),
      createdAt: Date.now(),
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
      },
    );
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
});
