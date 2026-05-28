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

type Props = {
  open: boolean;
  itemName?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
};

const confirmOutlineButtonClass =
  "focus-visible:ring-0 focus-visible:border-border dark:focus-visible:border-input";
const confirmPrimaryButtonClass = "focus-visible:ring-0 focus-visible:border-transparent";

export function PosRemoveDialog({
  open,
  itemName,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<"cancel" | "delete">("delete");

  const submit = () => {
    if (selected === "delete") {
      onConfirm();
      return;
    }
    onClose();
  };

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            event.stopPropagation();
            setSelected((prev) => (prev === "delete" ? "cancel" : "delete"));
            return;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            submit();
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{title ?? "Hapus item?"}</DialogTitle>
          <DialogDescription>
            {description ?? `${itemName ?? "Item ini"} akan dihapus dari keranjang.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className={`${confirmOutlineButtonClass} ${selected === "cancel" ? "ring-2 ring-white" : ""}`}
            onClick={() => {
              setSelected("cancel");
              onClose();
            }}
            type="button"
            variant="outline"
          >
            Batal
          </Button>
          <Button
            className={`${confirmPrimaryButtonClass} ${selected === "delete" ? "ring-2 ring-white" : ""}`}
            onClick={() => {
              setSelected("delete");
              onConfirm();
            }}
            type="button"
            variant="destructive"
          >
            {confirmLabel ?? "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
