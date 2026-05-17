import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

function MockWarning({
  open,
  onBypass,
}: {
  open: boolean;
  onBypass: () => void;
}) {
  if (!open) return null;

  return (
    <div
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Escape") onBypass();
      }}
    >
      Stok barang ini kurang, stock akhir akan 0 atau minus!
    </div>
  );
}

describe("negative stock warning behavior (RED)", () => {
  it("shows exact D-10 Indonesian copy", () => {
    render(<MockWarning open onBypass={() => undefined} />);

    expect(
      screen.getByText("Stok barang ini kurang, stock akhir akan 0 atau mines!"),
    ).toBeInTheDocument();
  });

  it("Enter confirms bypass and allows continuation", () => {
    const onBypass = vi.fn();
    render(<MockWarning open onBypass={onBypass} />);

    fireEvent.keyDown(screen.getByText(/Stok barang ini kurang/i), {
      key: "Enter",
    });

    expect(onBypass).toHaveBeenCalledTimes(1);
  });
});
