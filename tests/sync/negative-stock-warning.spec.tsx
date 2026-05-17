import { fireEvent, render, screen } from "@testing-library/react";
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
});
