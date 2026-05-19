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
  onClose: () => void;
  onConfirm: () => void;
};

export function PosRemoveDialog({ open, itemName, onClose, onConfirm }: Props) {
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
          <DialogTitle>Hapus item?</DialogTitle>
          <DialogDescription>{itemName ?? "Item ini"} akan dihapus dari keranjang.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className={selected === "cancel" ? "ring-2 ring-white" : ""}
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
            className={selected === "delete" ? "ring-2 ring-white" : ""}
            onClick={() => {
              setSelected("delete");
              onConfirm();
            }}
            type="button"
            variant="destructive"
          >
            Hapus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
