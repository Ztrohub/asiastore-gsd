import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PosScreen } from "@/features/pos/components/pos-screen";

vi.mock("@/features/inventory/hooks/use-product-catalog", () => ({
  useProductCatalog: () => ({
    products: [
      {
        id_produk: "p-1",
        nama_produk: "Kopi Susu",
        sku: "KOPI-001",
        harga_jual: 12000,
        harga_jual_unit_besar: 100000,
        stok_saat_ini: 10,
        stok_unit_besar_saat_ini: 0,
        is_active: true,
        allow_sell_in_small: true,
        allow_sell_in_large: true,
        unit_small_name: "pcs",
        unit_large_name: "dus",
        updatedAt: Date.now(),
      },
      {
        id_produk: "p-2",
        nama_produk: "Teh Tarik",
        sku: "TEH-001",
        harga_jual: 9000,
        stok_saat_ini: 5,
        stok_unit_besar_saat_ini: 0,
        is_active: true,
        updatedAt: Date.now(),
      },
      {
        id_produk: "p-3",
        nama_produk: "Kopi Tubruk",
        sku: "KOPI-003",
        harga_jual: 15000,
        stok_saat_ini: 6,
        stok_unit_besar_saat_ini: 0,
        is_active: true,
        updatedAt: Date.now(),
      },
    ],
    loading: false,
  }),
}));

vi.mock("@/features/pos/hooks/use-printer-bridge-settings", () => ({
  usePrinterBridgeSettings: () => ({
    settings: {
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
    },
  }),
}));

describe("pos keyboard cart flow", () => {
  it("supports direct typing search -> enter qty dialog -> add to cart without clicking search first", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    const search = screen.getByLabelText("Global Search");
    await user.keyboard("kopi");
    expect(search).toHaveValue("kopi");
    await user.keyboard("{Enter}");

    const qtyInput = await screen.findByLabelText("Qty");
    expect(qtyInput).toHaveValue("1");

    await user.keyboard("{Enter}");
    const cartPanel = screen.getByTestId("cart-panel");
    const summaryPanel = screen.getByTestId("transaction-summary-panel");
    expect(within(cartPanel).getByText("Kopi Susu (pcs)")).toBeInTheDocument();
    expect(within(cartPanel).queryByText("Diskon total transaksi (IDR)")).not.toBeInTheDocument();
    expect(
      within(cartPanel).queryByText("Tekan Enter untuk edit qty/subtotal item"),
    ).not.toBeInTheDocument();
    expect(within(summaryPanel).getByTestId("order-discount-input")).toHaveValue("0");
    expect(screen.getByTestId("cart-total")).toHaveTextContent(/12\.000/);
    expect(within(summaryPanel).getByRole("button", { name: "Tunai (F8)" })).toBeEnabled();
    expect(within(summaryPanel).getByRole("button", { name: "Transfer (F9)" })).toBeEnabled();
  });

  it("selects default qty in add-to-cart dialog so typing replaces the default value", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    await user.keyboard("{Enter}");
    const qtyInput = await screen.findByLabelText("Qty");
    expect(qtyInput).toHaveValue("1");

    await user.keyboard("5");
    await user.keyboard("{Enter}");

    const cartRow = screen.getByTestId("cart-row-0");
    expect(cartRow).toHaveTextContent("Kopi Susu (pcs)");
    expect(cartRow).toHaveTextContent(/5\s*x\s*Rp\s*12\.000/);
  });

  it("supports choosing large unit with keyboard in qty dialog", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    await user.keyboard("kopi");
    await user.keyboard("{Enter}");

    const qtyInput = await screen.findByLabelText("Qty");
    expect(qtyInput).toBeInTheDocument();
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Kopi Susu (dus)")).toBeInTheDocument();
  });

  it("shows not-found message and enter does nothing", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    const search = screen.getByLabelText("Global Search");
    await user.type(search, "tidak-ada");

    expect(screen.getByText("Produk tidak ditemukan")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.queryByText("Qty Item")).not.toBeInTheDocument();
  });

  it("ranks the closest fuzzy product first and highlights the name in POS results", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    await user.keyboard("susu kopi");

    const firstRow = screen.getByTestId("product-row-0");
    expect(firstRow).toHaveTextContent("Kopi Susu");
    expect(firstRow.querySelector("strong")).not.toBeNull();
  });

  it("supports cart edit via arrow right + enter and delete confirmation", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    const search = screen.getByLabelText("Global Search");
    await user.click(search);
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(screen.getByText("Edit Item Keranjang")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    fireEvent.keyDown(search, { key: "Delete" });
    expect(await screen.findByText("Hapus item?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Batal" })).toHaveClass("focus-visible:ring-0");
    expect(screen.getByRole("button", { name: "Hapus" })).toHaveClass("focus-visible:ring-0");
  });

  it("selects cart qty on edit and provides a delete action from the edit dialog", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Edit Item Keranjang")).toBeInTheDocument();
    const qtyInput = screen.getByLabelText("Qty Item Keranjang");
    expect(qtyInput).toHaveValue("1");
    expect(screen.getByRole("button", { name: "Hapus" })).toBeInTheDocument();

    await user.keyboard("3");
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("cart-row-0")).toHaveTextContent(/3\s*x\s*Rp\s*12\.000/);

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Hapus" }));
    expect(await screen.findByText("Hapus item?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hapus" }));

    expect(screen.getByText("Belum ada item.")).toBeInTheDocument();
  });

  it("keeps item subtotal in sync with edited qty until the cashier overrides it", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");

    const qtyInput = screen.getByLabelText("Qty Item Keranjang");
    const subtotalInput = screen.getByLabelText("Subtotal Akhir Item");

    expect(qtyInput).toHaveValue("1");
    expect(subtotalInput).toHaveValue("12000");

    await user.keyboard("2");

    expect(qtyInput).toHaveValue("2");
    expect(subtotalInput).toHaveValue("24000");

    await user.keyboard("{Enter}");

    expect(screen.getByTestId("cart-row-0")).toHaveTextContent(/2\s*x\s*Rp\s*12\.000/);
    expect(screen.getByTestId("cart-total")).toHaveTextContent(/24\.000/);
  });

  it("uses Delete in cart edit dialog to open delete confirmation instead of clearing qty", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");

    const qtyInput = screen.getByLabelText("Qty Item Keranjang");
    expect(qtyInput).toHaveValue("1");

    await user.keyboard("{Delete}");

    expect(await screen.findByText("Hapus item?")).toBeInTheDocument();
    expect(screen.getByText("Kopi Susu (pcs)")).toBeInTheDocument();
  });

  it("shows a red void button and requires confirmation before resetting the active transaction", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    const summaryPanel = screen.getByTestId("transaction-summary-panel");
    const search = screen.getByLabelText("Global Search");
    const noteInput = within(summaryPanel).getByTestId("transaction-note");
    const discountInput = within(summaryPanel).getByTestId("order-discount-input");
    const voidButton = within(summaryPanel).getByRole("button", { name: "Void (F10)" });

    expect(voidButton).toBeDisabled();
    expect(voidButton).toHaveClass("bg-destructive");

    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    await user.clear(discountInput);
    await user.type(discountInput, "1000");
    await user.type(noteInput, "Batalkan transaksi ini");

    expect(voidButton).toBeEnabled();
    await user.click(voidButton);

    expect(screen.getByText("Void transaksi?")).toBeInTheDocument();
    expect(
      screen.getByText("Semua item, diskon, dan catatan transaksi akan dihapus."),
    ).toBeInTheDocument();
    expect(screen.getByText("Kopi Susu (pcs)")).toBeInTheDocument();
    expect(noteInput).toHaveValue("Batalkan transaksi ini");
    expect(discountInput).toHaveValue("1000");

    await user.click(screen.getByRole("button", { name: "Batal" }));
    expect(screen.queryByText("Void transaksi?")).not.toBeInTheDocument();
    expect(screen.getByText("Kopi Susu (pcs)")).toBeInTheDocument();

    await user.click(voidButton);
    await user.click(screen.getByRole("button", { name: "Void transaksi" }));

    expect(screen.getByText("Belum ada item.")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent(/Rp\s*0/);
    expect(noteInput).toHaveValue("");
    expect(discountInput).toHaveValue("0");
    expect(voidButton).toBeDisabled();
    expect(search).toHaveFocus();
  });

  it("supports opening void confirmation with F10 and confirming by keyboard", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    const search = screen.getByLabelText("Global Search");
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Kopi Susu (pcs)")).toBeInTheDocument();
    await user.keyboard("{F10}");

    expect(screen.getByText("Void transaksi?")).toBeInTheDocument();
    expect(screen.getByText("Kopi Susu (pcs)")).toBeInTheDocument();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Belum ada item.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Void (F10)" })).toBeDisabled();
    expect(search).toHaveFocus();
  });

  it("opens payment dialog from cart cash button", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    await user.click(screen.getByRole("button", { name: "Tunai (F8)" }));
    expect(await screen.findByText("Pembayaran Tunai")).toBeInTheDocument();
  });
});
