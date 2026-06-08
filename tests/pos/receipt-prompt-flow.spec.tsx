import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PosReceiptPrompt } from "@/features/pos/components/pos-receipt-prompt";

describe("receipt prompt flow", () => {
  it("defaults to Print and supports arrow key navigation", async () => {
    const user = userEvent.setup();
    const onPrint = vi.fn();
    const onSkip = vi.fn();
    render(
      <PosReceiptPrompt
        onPrint={onPrint}
        onSkip={onSkip}
        open
        printError={null}
        printing={false}
        transaction={{
          change_amount: 5000,
          payment_method: "cash",
        }}
      />,
    );
    const printButton = screen.getByRole("button", { name: "Print" });
    const skipButton = screen.getByRole("button", { name: "Lewati" });
    expect(printButton).toHaveClass("ring-2");
    expect(printButton).toHaveClass("border-white");
    expect(printButton).toHaveClass("focus-visible:ring-0");
    expect(printButton).toHaveClass("focus-visible:border-transparent");
    expect(skipButton).toHaveClass("focus-visible:ring-0");
    expect(skipButton).toHaveClass("focus-visible:border-border");

    await user.keyboard("{Enter}");
    expect(onPrint).toHaveBeenCalledTimes(1);

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("keeps focus and white cursor in sync when moving back and forth between actions", async () => {
    const user = userEvent.setup();
    render(
      <PosReceiptPrompt
        onPrint={vi.fn()}
        onSkip={vi.fn()}
        open
        printError={null}
        printing={false}
        transaction={{
          change_amount: 5000,
          payment_method: "cash",
        }}
      />,
    );

    const printButton = screen.getByRole("button", { name: "Print" });
    const skipButton = screen.getByRole("button", { name: "Lewati" });

    expect(printButton).toHaveFocus();
    expect(printButton).toHaveClass("ring-2");

    await user.keyboard("{ArrowLeft}");
    expect(skipButton).toHaveFocus();
    expect(skipButton).toHaveClass("ring-2");
    expect(skipButton).toHaveClass("bg-primary/10");
    expect(skipButton).toHaveClass("border-white");
    expect(printButton).not.toHaveClass("ring-2");

    await user.keyboard("{ArrowRight}");
    expect(printButton).toHaveFocus();
    expect(printButton).toHaveClass("ring-2");
    expect(printButton).toHaveClass("border-white");
    expect(skipButton).not.toHaveClass("ring-2");
  });

  it("shows error without retry control", () => {
    render(
      <PosReceiptPrompt
        onPrint={vi.fn()}
        onSkip={vi.fn()}
        open
        printError="Print gagal. Silakan cek printer."
        printing={false}
        transaction={{
          change_amount: 5000,
          payment_method: "cash",
        }}
      />,
    );
    expect(screen.getByText("Print gagal. Silakan cek printer.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("shows cash change in a prominent block", () => {
    render(
      <PosReceiptPrompt
        onPrint={vi.fn()}
        onSkip={vi.fn()}
        open
        printError={null}
        printing={false}
        transaction={{
          change_amount: 8000,
          payment_method: "cash",
        }}
      />,
    );

    expect(screen.getByText("Kembalian customer")).toBeInTheDocument();
    const changeAmount = screen.getByTestId("receipt-change-amount");
    expect(changeAmount).toHaveTextContent(/Rp\s*8\.000/);
    expect(changeAmount).toHaveClass("text-4xl");
    expect(changeAmount).toHaveClass("font-semibold");
  });

  it("hides the change block for non-cash transactions", () => {
    render(
      <PosReceiptPrompt
        onPrint={vi.fn()}
        onSkip={vi.fn()}
        open
        printError={null}
        printing={false}
        transaction={{
          change_amount: undefined,
          payment_method: "bank_transfer",
        }}
      />,
    );

    expect(screen.queryByText("Kembalian customer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("receipt-change-amount")).not.toBeInTheDocument();
  });

  it("shows a transfer copy confirmation prompt after the first print", () => {
    render(
      <PosReceiptPrompt
        onPrint={vi.fn()}
        onSkip={vi.fn()}
        open
        printError={null}
        printing={false}
        transaction={{
          change_amount: undefined,
          payment_method: "bank_transfer",
        }}
        variant="copy-confirm"
      />,
    );

    expect(screen.getByText("Print copy nota?")).toBeInTheDocument();
    expect(screen.getByText("Nota transfer pertama sudah tercetak. Print copy kedua?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tidak" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ya, print copy" })).toBeInTheDocument();
    expect(screen.queryByTestId("receipt-change-amount")).not.toBeInTheDocument();
  });
});
