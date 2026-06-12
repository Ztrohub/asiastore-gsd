import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductFormDialog } from "@/features/inventory/components/product-form-dialog";

describe("product form special prices", () => {
  it("submits special price rows from the product master form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductFormDialog
        editingProduct={null}
        onClose={() => undefined}
        onSubmit={onSubmit}
        open
      />,
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nama produk"), {
      target: { value: "Kopi Spesial" },
    });
    fireEvent.change(within(dialog).getByLabelText("Harga jual unit kecil"), {
      target: { value: "10000" },
    });

    await user.click(within(dialog).getByRole("button", { name: "Tambah harga khusus" }));
    fireEvent.change(within(dialog).getByLabelText("Qty harga khusus 1"), {
      target: { value: "0.5" },
    });
    fireEvent.change(within(dialog).getByLabelText("Harga khusus 1"), {
      target: { value: "6000" },
    });

    await user.click(within(dialog).getByRole("button", { name: "Simpan Produk" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      nama_produk: "Kopi Spesial",
      harga_jual: 10000,
      special_prices: [{ unit_mutasi: "SMALL", qty_tenths: 5, harga: 6000 }],
    });
  });

  it("rejects duplicate special-price qty rows for the same unit before submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductFormDialog
        editingProduct={null}
        onClose={() => undefined}
        onSubmit={onSubmit}
        open
      />,
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nama produk"), {
      target: { value: "Kopi Spesial" },
    });
    fireEvent.change(within(dialog).getByLabelText("Harga jual unit kecil"), {
      target: { value: "10000" },
    });

    await user.click(within(dialog).getByRole("button", { name: "Tambah harga khusus" }));
    await user.click(within(dialog).getByRole("button", { name: "Tambah harga khusus" }));

    fireEvent.change(within(dialog).getByLabelText("Qty harga khusus 1"), {
      target: { value: "0.5" },
    });
    fireEvent.change(within(dialog).getByLabelText("Harga khusus 1"), {
      target: { value: "6000" },
    });
    fireEvent.change(within(dialog).getByLabelText("Qty harga khusus 2"), {
      target: { value: "0.5" },
    });
    fireEvent.change(within(dialog).getByLabelText("Harga khusus 2"), {
      target: { value: "6200" },
    });

    await user.click(within(dialog).getByRole("button", { name: "Simpan Produk" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText("Qty harga khusus untuk unit yang sama tidak boleh duplikat."),
    ).toBeInTheDocument();
  });
});
