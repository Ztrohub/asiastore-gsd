"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type DialogActionVariant = "outline" | "solid";

const dialogOutlineActionClass =
  "focus-visible:ring-0 focus-visible:border-border dark:focus-visible:border-input";
const dialogSolidActionClass = "focus-visible:ring-0 focus-visible:border-transparent";
const dialogSelectedActionClass = "ring-2 ring-white";

export function isDialogActionNavigationTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return true;
  if (element.isContentEditable) return false;

  const tag = element.tagName.toLowerCase();
  return tag !== "input" && tag !== "textarea" && tag !== "select";
}

export function getDialogActionButtonClass({
  selected,
  variant,
}: {
  selected: boolean;
  variant: DialogActionVariant;
}) {
  return cn(
    variant === "outline" ? dialogOutlineActionClass : dialogSolidActionClass,
    selected ? dialogSelectedActionClass : null,
  );
}

export function useDialogActionNavigation<T extends string>({
  actions,
  defaultAction,
}: {
  actions: readonly T[];
  defaultAction: T;
}) {
  const [selectedAction, setSelectedAction] = useState<T>(defaultAction);

  function moveSelectedAction(delta: number) {
    const currentIndex = Math.max(0, actions.indexOf(selectedAction));
    const nextIndex = (currentIndex + delta + actions.length) % actions.length;
    setSelectedAction(actions[nextIndex]);
  }

  return { selectedAction, setSelectedAction, moveSelectedAction };
}
