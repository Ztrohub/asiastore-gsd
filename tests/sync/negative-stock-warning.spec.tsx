import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NegativeStockWarning } from "@/features/inventory/components/negative-stock-warning";

describe("negative stock warning behavior", () => {
  it("shows exact D-10 Indonesian copy", () => {
    render(<NegativeStockWarning open onBypass={() => undefined} onClose={() => undefined} />);

    expect(
      screen.getByText("Stok barang ini kurang, stock akhir akan 0 atau mines!"),
    ).toBeInTheDocument();
  });

  it("Enter confirms bypass and allows continuation", () => {
    const onBypass = vi.fn();
    render(<NegativeStockWarning open onBypass={onBypass} onClose={() => undefined} />);

    fireEvent.keyDown(screen.getByText(/Stok barang ini kurang/i), {
      key: "Enter",
    });

    expect(onBypass).toHaveBeenCalledTimes(1);
  });

  it("shows a white cursor and supports arrow navigation between actions", async () => {
    const user = userEvent.setup();
    const onBypass = vi.fn();
    const onClose = vi.fn();

    render(<NegativeStockWarning open onBypass={onBypass} onClose={onClose} />);

    const cancelButton = screen.getByRole("button", { name: "Batal" });
    const proceedButton = screen.getByRole("button", { name: "Tetap Lanjut" });

    expect(proceedButton).toHaveClass("ring-2");
    expect(cancelButton).toHaveClass("focus-visible:ring-0");
    expect(proceedButton).toHaveClass("focus-visible:ring-0");

    await user.keyboard("{ArrowLeft}");
    await user.keyboard("{Enter}");

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onBypass).not.toHaveBeenCalled();
  });
});
