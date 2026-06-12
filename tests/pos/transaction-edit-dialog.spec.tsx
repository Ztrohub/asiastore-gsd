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
});
