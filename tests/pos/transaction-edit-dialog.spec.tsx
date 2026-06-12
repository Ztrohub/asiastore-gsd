import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionEditDialog } from "@/features/pos/components/transaction-edit-dialog";
import type { PosCartLine } from "@/features/pos/hooks/use-pos-cart";
import type { PosLinePricingSnapshot } from "@/lib/pricing/special-price";

type CartLineRequiresPricingSnapshot = PosCartLine extends {
  pricing_snapshot: PosLinePricingSnapshot;
}
  ? true
  : false;

const cartLineRequiresPricingSnapshot: CartLineRequiresPricingSnapshot = true;
void cartLineRequiresPricingSnapshot;

const pricingSnapshot = {
  base_unit_price: 10000,
  automatic_subtotal: 17000,
  rules: [{ unit_mutasi: "SMALL" as const, qty_tenths: 5, harga: 6000 }],
  breakdown: [
    { qty: 1.1, unit_price: 10000, total: 11000, source: "base" as const },
    { qty: 0.5, unit_price: 6000, total: 6000, source: "special" as const },
  ],
};

vi.mock("@/features/inventory/hooks/use-product-catalog", () => ({
  useProductCatalog: () => ({
    products: [],
    loading: false,
    error: null,
  }),
}));

describe("transaction edit dialog responsive shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses dynamic viewport height constraints so the action footer stays inside mobile and tablet browser chrome", () => {
    render(
      <TransactionEditDialog
        onClose={() => undefined}
        onDelete={async () => undefined}
        onRestore={async () => undefined}
        onSave={async () => undefined}
        open
        transaction={{
          id_transaksi: "tx-1",
          short_id: "TRX-001",
          kasir_user_id: "cashier-1",
          kasir_username: "kasir",
          payment_method: "cash",
          subtotal_amount: 10000,
          item_discount: 0,
          order_discount: 0,
          total_amount: 10000,
          amount_received: 10000,
          change_amount: 0,
          counts_for_cash: true,
          note: "catatan",
          is_deleted: false,
          lines: [
            {
              id_produk: "prod-1",
              nama_produk: "Produk 1",
              unit_price: 10000,
              qty: 1,
              unit_mutasi: "SMALL",
              unit_label: "pcs",
              line_discount: 0,
              line_total: 10000,
            },
          ],
          client_timestamp: Date.parse("2026-06-09T10:00:00.000Z"),
          createdAt: Date.parse("2026-06-09T10:00:00.000Z"),
        }}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: /Edit transaksi TRX-001/i });
    expect(dialog.className).toContain("max-h-[calc(100dvh-1rem)]");
    expect(dialog.className).toContain("sm:max-h-[calc(100dvh-2rem)]");
  });

  it("renders pricing snapshot breakdown rows in the editable transaction item list", () => {
    render(
      <TransactionEditDialog
        onClose={() => undefined}
        onDelete={async () => undefined}
        onRestore={async () => undefined}
        onSave={async () => undefined}
        open
        transaction={{
          id_transaksi: "tx-1",
          short_id: "TRX-001",
          kasir_user_id: "cashier-1",
          kasir_username: "kasir",
          payment_method: "cash",
          subtotal_amount: 17000,
          item_discount: 0,
          order_discount: 0,
          total_amount: 17000,
          amount_received: 20000,
          change_amount: 3000,
          counts_for_cash: true,
          note: "catatan",
          is_deleted: false,
          lines: [
            {
              id_produk: "prod-1",
              nama_produk: "Produk Special",
              unit_price: 10000,
              qty: 1.6,
              unit_mutasi: "SMALL",
              unit_label: "pcs",
              line_discount: 0,
              line_total: 17000,
              pricing_snapshot: pricingSnapshot,
            },
          ],
          client_timestamp: Date.parse("2026-06-09T10:00:00.000Z"),
          createdAt: Date.parse("2026-06-09T10:00:00.000Z"),
        }}
      />,
    );

    expect(screen.getByText(/1,1 x Rp\s*10\.000/)).toBeInTheDocument();
    expect(screen.getByText(/0,5 x Rp\s*6\.000/)).toBeInTheDocument();
  });
});
