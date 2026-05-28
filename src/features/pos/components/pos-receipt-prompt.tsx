"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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

const promptOutlineButtonClass =
  "focus-visible:ring-0 focus-visible:border-border dark:focus-visible:border-input";
const promptPrimaryButtonClass = "focus-visible:ring-0 focus-visible:border-transparent";

export function PosReceiptPrompt({ open, printError, printing, onSkip, onPrint }: PosReceiptPromptProps) {
  const [selected, setSelected] = useState<"print" | "skip">("print");

  const submit = async () => {
    if (selected === "print") {
      await onPrint();
      return;
    }
    onSkip();
  };

  return (
    <Dialog onOpenChange={(state) => !state && onSkip()} open={open}>
      <DialogContent
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            setSelected((prev) => (prev === "print" ? "skip" : "print"));
            return;
          }
          if (event.key === "Enter") {
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
            className={`${promptOutlineButtonClass} ${selected === "skip" ? "ring-2 ring-white" : ""}`}
            onClick={() => {
              setSelected("skip");
              onSkip();
            }}
            type="button"
            variant="outline"
          >
            Lewati
          </Button>
          <Button
            className={`${promptPrimaryButtonClass} ${selected === "print" ? "ring-2 ring-white" : ""}`}
            disabled={printing}
            onClick={async () => {
              setSelected("print");
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
