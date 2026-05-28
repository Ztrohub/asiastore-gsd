import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PosCartItemDialog } from "@/features/pos/components/pos-cart-item-dialog";
import { PosPaymentDialog } from "@/features/pos/components/pos-payment-dialog";
import { PosQtyDialog } from "@/features/pos/components/pos-qty-dialog";
import { PosRemoveDialog } from "@/features/pos/components/pos-remove-dialog";
import { ProductFormDialog } from "@/features/inventory/components/product-form-dialog";

describe("dialog action navigation", () => {
  it("uses a white cursor and arrow navigation in the payment dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <PosPaymentDialog
        lines={[
          {
            id_produk: "p-1",
            nama_produk: "Kopi Susu",
            qty: 1,
            unit_label: "pcs",
            unit_mutasi: "SMALL",
            unit_price: 12000,
            line_discount: 0,
          },
        ]}
        onClose={onClose}
        onSubmit={onSubmit}
        open
        orderDiscount={0}
        paymentMethod="bank_transfer"
      />,
    );

    const cancelButton = screen.getByRole("button", { name: "Batal" });
    const processButton = screen.getByRole("button", { name: "Proses transaksi" });

    expect(processButton).toHaveClass("ring-2");
    expect(cancelButton).toHaveClass("focus-visible:ring-0");
    expect(processButton).toHaveClass("focus-visible:border-transparent");

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{Enter}");
    expect(onClose).toHaveBeenCalledTimes(1);

    cancelButton.focus();
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps qty input shortcuts and allows footer navigation in the qty dialog", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <PosQtyDialog
        defaultQty="1"
        defaultUnitMutasi="SMALL"
        onClose={() => undefined}
        onConfirm={onConfirm}
        open
        productName="Kopi Susu"
        unitOptions={[
          { unit_label: "pcs", unit_mutasi: "SMALL", unit_price: 12000 },
          { unit_label: "dus", unit_mutasi: "LARGE", unit_price: 100000 },
        ]}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: "Batal" });
    const saveButton = screen.getByRole("button", { name: "Simpan" });

    expect(saveButton).toHaveClass("ring-2");
    expect(cancelButton).toHaveClass("focus-visible:ring-0");
    expect(saveButton).toHaveClass("focus-visible:border-transparent");

    await user.keyboard("{ArrowRight}");
    cancelButton.focus();
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");

    expect(onConfirm).toHaveBeenCalledWith({ qty: "1", unit_mutasi: "LARGE" });
  });

  it("supports arrow navigation across edit-cart dialog actions", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <PosCartItemDialog
        line={{
          id_produk: "p-1",
          nama_produk: "Kopi Susu",
          qty: 1,
          harga_jual: 12000,
          unit_label: "pcs",
          unit_mutasi: "SMALL",
          line_discount: 0,
        }}
        onClose={() => undefined}
        onConfirm={() => undefined}
        onDelete={onDelete}
        open
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Hapus" });
    const cancelButton = screen.getByRole("button", { name: "Batal" });
    const saveButton = screen.getByRole("button", { name: "Simpan" });

    expect(saveButton).toHaveClass("ring-2");
    expect(deleteButton).toHaveClass("focus-visible:ring-0");
    expect(cancelButton).toHaveClass("focus-visible:border-border");

    cancelButton.focus();
    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{Enter}");

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("keeps remove-dialog focus and white cursor in sync when arrows move back and forth", async () => {
    const user = userEvent.setup();

    render(
      <PosRemoveDialog
        itemName="Kopi Susu"
        onClose={() => undefined}
        onConfirm={() => undefined}
        open
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Hapus" });
    const cancelButton = screen.getByRole("button", { name: "Batal" });

    expect(deleteButton).toHaveFocus();
    expect(deleteButton).toHaveClass("ring-2");

    await user.keyboard("{ArrowLeft}");
    expect(cancelButton).toHaveFocus();
    expect(cancelButton).toHaveClass("ring-2");
    expect(deleteButton).not.toHaveClass("ring-2");

    await user.keyboard("{ArrowRight}");
    expect(deleteButton).toHaveFocus();
    expect(deleteButton).toHaveClass("ring-2");
    expect(cancelButton).not.toHaveClass("ring-2");
  });

  it("applies the same white cursor styling to the product form dialog footer", () => {
    render(
      <ProductFormDialog
        editingProduct={null}
        onClose={() => undefined}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        open
      />,
    );

    const cancelButton = screen.getByRole("button", { name: "Batal" });
    const saveButton = screen.getByRole("button", { name: "Simpan Produk" });

    expect(saveButton).toHaveClass("ring-2");
    expect(cancelButton).toHaveClass("focus-visible:ring-0");
    expect(saveButton).toHaveClass("focus-visible:border-transparent");
  });
});
