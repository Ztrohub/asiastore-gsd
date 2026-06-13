---
phase: 03-pos-checkout-and-receipt-printing
reviewed: 2026-06-12T00:00:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - src/app/api/sync/pos-transactions/route.ts
  - src/features/pos/components/pos-cart-item-dialog.tsx
  - src/features/pos/components/pos-cart-panel.tsx
  - src/features/pos/components/pos-payment-dialog.tsx
  - src/features/pos/components/pos-screen.tsx
  - src/features/pos/components/pos-transactions-screen.tsx
  - src/features/pos/components/transaction-edit-dialog.tsx
  - src/features/pos/hooks/use-pos-cart.ts
  - src/features/pos/hooks/use-pos-checkout.ts
  - src/features/pos/lib/receipt-format.ts
  - src/features/pos/lib/transaction-history-update.ts
  - src/lib/db/pos-transactions.ts
  - src/lib/offline/db.ts
  - src/lib/offline/pos-transaction-history.ts
  - tests/pos/checkout-payment.spec.tsx
  - tests/pos/dialog-action-navigation.spec.tsx
  - tests/pos/keyboard-cart-flow.spec.tsx
  - tests/pos/pos-transaction-screen.spec.tsx
  - tests/pos/pos-transaction-sync.spec.ts
  - tests/pos/receipt-formatting.spec.ts
  - tests/pos/transaction-edit-dialog.spec.tsx
  - tests/pos/transaction-history-update.spec.ts
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-12T00:00:00Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The patch consistently threads `pricing_snapshot` through checkout, receipt formatting, local persistence, queue payloads, and transaction detail rendering. The main defects are in cross-device resync of edited transactions, dialog state reuse inside transaction editing, and the lack of runtime validation for snapshot JSON before it is trusted by the edit flow.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Edited transactions never re-sync to devices that already advanced their cursor

**File:** `src/lib/db/pos-transactions.ts:60`

**Issue:** The sync cursor is still based on immutable `createdAt` (`getPosTransactionSyncTime()` and `listPosTransactionsForSync()` both use `createdAt`). When a transaction is edited, deleted, restored, or has its `pricing_snapshot` changed, the server `upsert` rewrites the row and lines but does not move `createdAt`. Any device that has already synced past the original creation timestamp will never receive the updated lines or snapshot on subsequent GET syncs. This breaks the stated requirement that edited transaction history and snapshots survive server persistence and sync reads across devices.

**Fix:**
```ts
// Use a mutable cursor field that changes on every write.
model PosTransaction {
  // ...
  sync_cursor_at DateTime @updatedAt
}

export function getPosTransactionSyncTime(transaction: { sync_cursor_at: Date }) {
  return transaction.sync_cursor_at.getTime();
}

orderBy: [{ sync_cursor_at: "asc" }, { id_transaksi: "asc" }]
// and filter by sync_cursor_at instead of createdAt
```

### CR-02: Reopening the cart item dialog for a different line reuses the previous line's qty/subtotal state

**File:** `src/features/pos/components/pos-cart-item-dialog.tsx:68`

**Issue:** `PosCartItemDialog` seeds `qtyInput`, `finalSubtotalInput`, and `hasManualSubtotalOverride` from props exactly once, then never resets them when `line` changes. In the main POS screen this is masked by a changing `key`, but `TransactionEditDialog` mounts the component without a `key` (`src/features/pos/components/transaction-edit-dialog.tsx:494`). Editing line A, closing, then editing line B in the same transaction shows B's label with A's stale qty/subtotal state and can save the wrong values onto B. That is direct transaction data corruption.

**Fix:**
```tsx
useEffect(() => {
  if (!open) return;
  setQtyInput(line ? String(line.qty) : "1");
  setFinalSubtotalInput(String(getFinalSubtotal(line)));
  setHasManualSubtotalOverride(hasSubtotalOverride(line));
}, [open, line]);
```

## Warnings

### WR-01: The transaction edit screen still renders naive `qty x unit_price` rows instead of the mixed-price breakdown

**File:** `src/features/pos/components/transaction-edit-dialog.tsx:279`

**Issue:** Cart, payment, transaction detail, and receipt views were updated to render `pricing_snapshot.breakdown`, but the transaction edit screen still shows a single `line.qty x line.harga_jual` row. For special-priced lines this hides the required `1,1 x Rp 10.000` / `0,5 x Rp 6.000` split and makes the edit flow inconsistent with the rest of the POS.

**Fix:**
```tsx
const breakdown = line.pricing_snapshot.breakdown;

{breakdown.length > 0 ? (
  <div className="space-y-0.5 text-xs text-muted-foreground">
    {breakdown.map((row, i) => (
      <p key={`${line.id_produk}-breakdown-${i}`}>
        {formatQuantityForDisplay(row.qty)} x {formatCurrencyIdr(row.unit_price)}
      </p>
    ))}
  </div>
) : (
  <p className="text-xs text-muted-foreground">
    {formatQuantityForDisplay(line.qty)} x {formatCurrencyIdr(line.harga_jual)}
  </p>
)}
```

### WR-02: Snapshot JSON is trusted via raw casts at the server persistence boundary

**File:** `src/lib/db/pos-transactions.ts:52`

**Issue:** `serializePricingSnapshot()` and `deserializePricingSnapshot()` are plain casts, and the sync POST body accepts nested `pricing_snapshot` objects with no runtime validation. A buggy or hostile client can persist malformed JSON that later flows into reopen/edit logic, where `TransactionEditDialog` dereferences `line.pricing_snapshot.base_unit_price`, `rules`, and `automatic_subtotal` directly. The result is `NaN` totals or unusable edited transactions.

**Fix:**
```ts
function isPricingSnapshot(value: unknown): value is PosLinePricingSnapshot {
  // validate object shape, numbers, arrays, and enum values
}

function deserializePricingSnapshot(value: Prisma.JsonValue | null | undefined) {
  return isPricingSnapshot(value) ? value : undefined;
}

if (line.pricing_snapshot && !isPricingSnapshot(line.pricing_snapshot)) {
  throw new Error("pricing_snapshot tidak valid");
}
```

---

_Reviewed: 2026-06-12T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
