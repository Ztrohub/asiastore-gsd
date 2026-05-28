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

type Props = {
  open: boolean;
  itemName?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
};

export function PosRemoveDialog({
  open,
  itemName,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
}: Props) {
  const { moveSelectedAction, selectedAction, setSelectedAction } = useDialogActionNavigation({
    actions: ["cancel", "delete"] as const,
    defaultAction: "delete",
  });

  const submit = () => {
    if (selectedAction === "delete") {
      onConfirm();
      return;
    }
    onClose();
  };

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
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
            className={getDialogActionButtonClass({
              selected: selectedAction === "cancel",
              variant: "outline",
            })}
            onFocus={() => setSelectedAction("cancel")}
            onClick={() => {
              setSelectedAction("cancel");
              onClose();
            }}
            type="button"
            variant="outline"
          >
            Batal
          </Button>
          <Button
            autoFocus
            className={getDialogActionButtonClass({
              selected: selectedAction === "delete",
              variant: "solid",
            })}
            onFocus={() => setSelectedAction("delete")}
            onClick={() => {
              setSelectedAction("delete");
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
