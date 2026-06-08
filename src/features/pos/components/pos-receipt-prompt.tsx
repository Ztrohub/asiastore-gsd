"use client";

import { Button } from "@/components/ui/button";
import {
  getDialogActionButtonClass,
  isDialogActionNavigationTarget,
  useDialogActionNavigation,
} from "@/components/ui/dialog-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyIdr } from "@/features/format/currency";
import type { ReceiptPromptVariant } from "@/features/pos/hooks/use-receipt-printing";
import type { PosTransactionRecord } from "@/lib/offline/db";

type PosReceiptPromptProps = {
  open: boolean;
  printError?: string | null;
  printing: boolean;
  onSkip: () => void;
  onPrint: () => Promise<void> | void;
  transaction?: Pick<PosTransactionRecord, "payment_method" | "change_amount"> | null;
  variant?: ReceiptPromptVariant;
};

export function PosReceiptPrompt({
  open,
  printError,
  printing,
  onSkip,
  onPrint,
  transaction,
  variant = "initial",
}: PosReceiptPromptProps) {
  const { moveSelectedAction, registerActionRef, selectedAction, setSelectedAction } =
    useDialogActionNavigation({
      actions: ["skip", "print"] as const,
      defaultAction: "print",
    });
  const isCopyConfirm = variant === "copy-confirm";
  const showChangeAmount = variant === "initial" && transaction?.payment_method === "cash";
  const changeAmount = Math.max(0, transaction?.change_amount ?? 0);
  const title = isCopyConfirm ? "Print copy nota?" : "Cetak receipt?";
  const description = isCopyConfirm
    ? "Nota transfer pertama sudah tercetak. Print copy kedua?"
    : "Transaksi sudah tersimpan. Cetak sekarang atau lewati.";
  const skipLabel = isCopyConfirm ? "Tidak" : "Lewati";
  const printLabel = isCopyConfirm ? "Ya, print copy" : "Print";

  const submit = async () => {
    if (selectedAction === "print") {
      await onPrint();
      return;
    }
    onSkip();
  };

  return (
    <Dialog onOpenChange={(state) => !state && onSkip()} open={open}>
      <DialogContent
        onKeyDown={(event) => {
          if (
            (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
            isDialogActionNavigationTarget(event.target)
          ) {
            event.preventDefault();
            event.stopPropagation();
            moveSelectedAction(event.key === "ArrowRight" ? 1 : -1);
            return;
          }
          if (event.key === "Enter" && isDialogActionNavigationTarget(event.target)) {
            event.preventDefault();
            event.stopPropagation();
            submit().catch(() => undefined);
          }
        }}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {showChangeAmount ? (
          <div className="rounded-lg border border-white bg-primary/10 px-4 py-5 text-center">
            <p className="text-sm font-medium text-muted-foreground">Kembalian customer</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl" data-testid="receipt-change-amount">
              {formatCurrencyIdr(changeAmount)}
            </p>
          </div>
        ) : null}
        {printError ? <p className="text-sm text-destructive">{printError}</p> : null}
        <DialogFooter>
          <Button
            className={getDialogActionButtonClass({
              selected: selectedAction === "skip",
              variant: "outline",
            })}
            onFocus={() => setSelectedAction("skip")}
            ref={registerActionRef("skip")}
            onClick={() => {
              setSelectedAction("skip");
              onSkip();
            }}
            type="button"
            variant="outline"
          >
            {skipLabel}
          </Button>
          <Button
            autoFocus
            className={getDialogActionButtonClass({
              selected: selectedAction === "print",
              variant: "solid",
            })}
            disabled={printing}
            onFocus={() => setSelectedAction("print")}
            ref={registerActionRef("print")}
            onClick={async () => {
              setSelectedAction("print");
              await onPrint();
            }}
            type="button"
          >
            {printLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
