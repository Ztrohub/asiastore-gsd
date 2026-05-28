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

type PosReceiptPromptProps = {
  open: boolean;
  printError?: string | null;
  printing: boolean;
  onSkip: () => void;
  onPrint: () => Promise<void> | void;
};

export function PosReceiptPrompt({ open, printError, printing, onSkip, onPrint }: PosReceiptPromptProps) {
  const { moveSelectedAction, selectedAction, setSelectedAction } = useDialogActionNavigation({
    actions: ["skip", "print"] as const,
    defaultAction: "print",
  });

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
          <DialogTitle>Cetak receipt?</DialogTitle>
          <DialogDescription>Transaksi sudah tersimpan. Cetak sekarang atau lewati.</DialogDescription>
        </DialogHeader>
        {printError ? <p className="text-sm text-destructive">{printError}</p> : null}
        <DialogFooter>
          <Button
            className={getDialogActionButtonClass({
              selected: selectedAction === "skip",
              variant: "outline",
            })}
            onFocus={() => setSelectedAction("skip")}
            onClick={() => {
              setSelectedAction("skip");
              onSkip();
            }}
            type="button"
            variant="outline"
          >
            Lewati
          </Button>
          <Button
            autoFocus
            className={getDialogActionButtonClass({
              selected: selectedAction === "print",
              variant: "solid",
            })}
            disabled={printing}
            onFocus={() => setSelectedAction("print")}
            onClick={async () => {
              setSelectedAction("print");
              await onPrint();
            }}
            type="button"
          >
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
