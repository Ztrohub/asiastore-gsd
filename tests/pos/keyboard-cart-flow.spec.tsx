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
    expect(within(cartPanel).getByText("Kopi Susu (pcs)")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent(/12\.000/);
    expect(screen.getByRole("button", { name: "Tunai (F8)" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Transfer (F9)" })).toBeEnabled();
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
  });

  it("shows a red void button and resets the active transaction when clicked", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    const cartPanel = screen.getByTestId("cart-panel");
    const search = screen.getByLabelText("Global Search");
    const noteInput = screen.getByTestId("transaction-note");
    const discountInput = within(cartPanel).getByRole("textbox");
    const voidButton = screen.getByRole("button", { name: "Void (F10)" });

    expect(voidButton).toBeDisabled();
    expect(voidButton).toHaveClass("bg-destructive");

    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    await user.clear(discountInput);
    await user.type(discountInput, "1000");
    await user.type(noteInput, "Batalkan transaksi ini");

    expect(voidButton).toBeEnabled();
    await user.click(voidButton);

    expect(screen.getByText("Belum ada item.")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent(/Rp\s*0/);
    expect(noteInput).toHaveValue("");
    expect(discountInput).toHaveValue("0");
    expect(voidButton).toBeDisabled();
    expect(search).toHaveFocus();
  });

  it("supports voiding the active transaction with F10", async () => {
    const user = userEvent.setup();
    render(<PosScreen />);

    const search = screen.getByLabelText("Global Search");
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");

    expect(screen.getByText("Kopi Susu (pcs)")).toBeInTheDocument();
    await user.keyboard("{F10}");

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
