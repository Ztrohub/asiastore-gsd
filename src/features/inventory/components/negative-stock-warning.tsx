"use client";

import { useEffect, useRef } from "react";
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
  onBypass: () => void;
  onClose: () => void;
};

export function NegativeStockWarning({ open, onBypass, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    containerRef.current?.focus();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent showCloseButton={false}>
        <div
          ref={containerRef}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onBypass();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Peringatan Stok</DialogTitle>
            <DialogDescription>
              Stok barang ini kurang, stock akhir akan 0 atau mines!
            </DialogDescription>
          </DialogHeader>
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Batal
          </Button>
          <Button autoFocus onClick={onBypass}>
            Tetap Lanjut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
