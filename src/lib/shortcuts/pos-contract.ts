export const posShortcutActions = {
  typeToSearch: "type-to-search",
  navigateUp: "navigate-up",
  navigateDown: "navigate-down",
  navigateLeft: "navigate-left",
  navigateRight: "navigate-right",
  submitItem: "submit-item",
  void: "void",
  cashPayment: "cash-payment",
  transferPayment: "transfer-payment",
} as const;

export type PosShortcutAction =
  (typeof posShortcutActions)[keyof typeof posShortcutActions];

export function getReservedPosShortcutActions(): PosShortcutAction[] {
  return Object.values(posShortcutActions);
}
