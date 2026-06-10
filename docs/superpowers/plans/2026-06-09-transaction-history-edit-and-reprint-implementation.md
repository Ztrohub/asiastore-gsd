# Transaction History Edit And Reprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transaction-history actions for reprint, full transaction editing, soft-delete/restore, and edit/delete audit metadata while keeping existing POS behavior unchanged.

**Architecture:** Keep POS checkout flow intact and add a separate transaction-history mutation path. Use additive schema and Dexie changes so existing production records remain valid, then layer a history edit dialog and confirmation dialogs on top of the existing transaction table.

**Tech Stack:** Next.js, React, Vitest, Dexie, Prisma, PostgreSQL

---

### Task 1: Lock Regression Coverage For Existing POS And Transaction History

**Files:**
- Modify: `tests/pos/pos-transaction-screen.spec.tsx`
- Modify: `tests/pos/use-receipt-printing.spec.tsx`
- Test: `tests/pos/pos-transaction-history.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add tests for:
- transaction row actions and deleted badge rendering
- reprint confirmation flow calling print path only after confirmation
- history rows preserving active POS behavior expectations already covered

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/pos/pos-transaction-screen.spec.tsx tests/pos/use-receipt-printing.spec.tsx`
Expected: FAIL because new actions, confirmation flow, and reprint API are not implemented.

- [ ] **Step 3: Write minimal implementation**

Implement only the smallest supporting API surface for the new tests after the tests fail.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/pos/pos-transaction-screen.spec.tsx tests/pos/use-receipt-printing.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/pos/pos-transaction-screen.spec.tsx tests/pos/use-receipt-printing.spec.tsx
git commit -m "test: cover transaction history actions"
```

### Task 2: Add Additive Transaction Audit Fields In Local DB And Server Schema

**Files:**
- Modify: `src/lib/offline/db.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260609190000_transaction_history_audit_fields/migration.sql`
- Modify: `src/lib/db/pos-transactions.ts`
- Modify: `src/app/api/sync/pos-transactions/route.ts`
- Test: `tests/pos/pos-transaction-history.spec.ts`

- [ ] **Step 1: Write the failing test**

Add tests asserting legacy records without the new fields still load and that sync mapping round-trips `is_deleted`, edit audit fields, delete audit fields, and line unit metadata.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/pos/pos-transaction-history.spec.ts`
Expected: FAIL because the local DB and sync serializers do not expose the new fields.

- [ ] **Step 3: Write minimal implementation**

Add additive Prisma columns with safe defaults and Dexie version bump with compatible indexes only. Extend transaction mapping and API payload types without changing existing checkout semantics.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/pos/pos-transaction-history.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/db.ts prisma/schema.prisma prisma/migrations/20260609190000_transaction_history_audit_fields/migration.sql src/lib/db/pos-transactions.ts src/app/api/sync/pos-transactions/route.ts tests/pos/pos-transaction-history.spec.ts
git commit -m "feat: add transaction audit fields"
```

### Task 3: Add Transaction-History Update/Soft-Delete/Restore Logic

**Files:**
- Create: `src/features/pos/lib/transaction-history-update.ts`
- Modify: `src/lib/offline/pos-transaction-history.ts`
- Modify: `src/features/pos/hooks/use-pos-transactions.ts`
- Test: `tests/pos/pos-transaction-history.spec.ts`

- [ ] **Step 1: Write the failing test**

Add tests for:
- editing a transaction updates totals and audit metadata
- soft-delete marks the row deleted without removing it
- restore reactivates the row while preserving additive compatibility

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/pos/pos-transaction-history.spec.ts`
Expected: FAIL because mutation helpers do not exist.

- [ ] **Step 3: Write minimal implementation**

Create isolated history mutation helpers that:
- read active local session
- rewrite the existing transaction record in Dexie
- update sync queue payload
- stamp `editedAt/editedBy*`
- stamp `deletedAt/deletedBy*` on delete
- set `is_deleted=false` and `editedAt/editedBy*` on restore

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/pos/pos-transaction-history.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/pos/lib/transaction-history-update.ts src/lib/offline/pos-transaction-history.ts src/features/pos/hooks/use-pos-transactions.ts tests/pos/pos-transaction-history.spec.ts
git commit -m "feat: support transaction history mutations"
```

### Task 4: Build Edit Transaction Dialog And Confirmation Dialogs

**Files:**
- Create: `src/features/pos/components/transaction-edit-dialog.tsx`
- Modify: `src/features/pos/components/pos-transactions-screen.tsx`
- Modify: `src/features/pos/components/pos-payment-dialog.tsx`
- Modify: `src/features/pos/components/pos-cart-item-dialog.tsx`
- Modify: `src/features/pos/components/pos-remove-dialog.tsx`
- Test: `tests/pos/pos-transaction-screen.spec.tsx`

- [ ] **Step 1: Write the failing test**

Add tests for:
- edit button opens dialog
- deleted transactions disable edit fields
- delete and restore each require confirmation
- save changes requires confirmation
- print ulang requires confirmation

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/pos/pos-transaction-screen.spec.tsx`
Expected: FAIL because the dialog and action buttons do not exist.

- [ ] **Step 3: Write minimal implementation**

Build a history-only dialog that reuses safe POS subcomponents where possible, but keeps POS active screen untouched. Show audit status and deleted badge, and disable all inputs while `is_deleted` is true.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/pos/pos-transaction-screen.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/pos/components/transaction-edit-dialog.tsx src/features/pos/components/pos-transactions-screen.tsx src/features/pos/components/pos-payment-dialog.tsx src/features/pos/components/pos-cart-item-dialog.tsx src/features/pos/components/pos-remove-dialog.tsx tests/pos/pos-transaction-screen.spec.tsx
git commit -m "feat: add transaction history edit dialog"
```

### Task 5: Wire Reprint To Existing Thermal Print Path

**Files:**
- Modify: `src/features/pos/hooks/use-receipt-printing.ts`
- Modify: `src/features/pos/components/pos-transactions-screen.tsx`
- Test: `tests/pos/use-receipt-printing.spec.tsx`

- [ ] **Step 1: Write the failing test**

Add a test for printing an arbitrary existing transaction without opening the POS checkout receipt flow.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest tests/pos/use-receipt-printing.spec.tsx`
Expected: FAIL because the hook cannot print a provided history transaction directly.

- [ ] **Step 3: Write minimal implementation**

Extend the print hook with a targeted method for history reprint that still uses `buildReceiptText` and `printReceiptThroughBridge`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest tests/pos/use-receipt-printing.spec.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/pos/hooks/use-receipt-printing.ts src/features/pos/components/pos-transactions-screen.tsx tests/pos/use-receipt-printing.spec.tsx
git commit -m "feat: support transaction history reprint"
```

### Task 6: Verify No POS Regression

**Files:**
- Test: `tests/pos/checkout-payment.spec.tsx`
- Test: `tests/pos/keyboard-cart-flow.spec.tsx`
- Test: `tests/pos/dialog-action-navigation.spec.tsx`
- Test: `tests/pos/receipt-prompt-flow.spec.tsx`
- Test: `tests/pos/pos-transaction-screen.spec.tsx`
- Test: `tests/pos/use-receipt-printing.spec.tsx`

- [ ] **Step 1: Run the targeted regression suite**

Run: `pnpm vitest tests/pos/checkout-payment.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx tests/pos/dialog-action-navigation.spec.tsx tests/pos/receipt-prompt-flow.spec.tsx tests/pos/pos-transaction-screen.spec.tsx tests/pos/use-receipt-printing.spec.tsx tests/pos/pos-transaction-history.spec.ts`
Expected: PASS

- [ ] **Step 2: Run Prisma validation**

Run: `pnpm prisma validate`
Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 3: Commit final artifact state**

```bash
git add .planning/quick/260609-nrd-menu-transaksi-tambah-aksi-edit-transaks/260609-nrd-PLAN.md docs/superpowers/plans/2026-06-09-transaction-history-edit-and-reprint-implementation.md
git commit -m "docs: record transaction history edit plan"
```
