"use client";

import { useEffect, useRef } from "react";
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

type Props = {
  open: boolean;
  onBypass: () => void;
  onClose: () => void;
};

export function NegativeStockWarning({ open, onBypass, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { moveSelectedAction, registerActionRef, selectedAction, setSelectedAction } =
    useDialogActionNavigation({
      actions: ["cancel", "confirm"] as const,
      defaultAction: "confirm",
    });

  useEffect(() => {
    if (!open) return;
    containerRef.current?.focus();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
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
            if (selectedAction === "confirm") {
              onBypass();
              return;
            }
            onClose();
          }
        }}
        showCloseButton={false}
      >
        <div
          ref={containerRef}
          tabIndex={0}
        >
          <DialogHeader>
            <DialogTitle>Peringatan Stok</DialogTitle>
            <DialogDescription>
              Stok barang ini kurang, stock akhir akan 0 atau mines!
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter>
          <Button
            className={getDialogActionButtonClass({
              selected: selectedAction === "cancel",
              variant: "outline",
            })}
            onClick={onClose}
            onFocus={() => setSelectedAction("cancel")}
            ref={registerActionRef("cancel")}
            variant="outline"
          >
            Batal
          </Button>
          <Button
            autoFocus
            className={getDialogActionButtonClass({
              selected: selectedAction === "confirm",
              variant: "solid",
            })}
            onClick={onBypass}
            onFocus={() => setSelectedAction("confirm")}
            ref={registerActionRef("confirm")}
          >
            Tetap Lanjut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
