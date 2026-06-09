# Compact Receipt Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the printed 58mm receipt much shorter while preserving every existing field and keeping long text fully readable through wrapping.

**Architecture:** Keep the current receipt formatter entry point and tighten only its text layout rules. Add regression tests that compare the new output against the legacy layout so the compact format is measurably shorter without dropping data.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Lock compact receipt behavior with tests

**Files:**
- Modify: `tests/pos/receipt-formatting.spec.ts`
- Test: `tests/pos/receipt-formatting.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("keeps all receipt fields while making the printed output much shorter", () => {
  // Build a legacy-format control receipt, then assert the current formatter
  // preserves all fields and reduces the line count by several lines.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/pos/receipt-formatting.spec.ts --reporter=verbose`
Expected: FAIL because the current formatter still uses the longer legacy layout.

- [ ] **Step 3: Write minimal implementation**

```ts
// In src/features/pos/lib/receipt-format.ts
// - wrap centered header/footer text instead of letting long lines overflow
// - remove redundant dividers
// - condense each item into wrapped name lines + one amount line + optional discount line
// - keep all summary/payment/id/footer fields
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/pos/receipt-formatting.spec.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/pos/receipt-formatting.spec.ts src/features/pos/lib/receipt-format.ts
git commit -m "feat: compact printed receipt layout"
```

### Task 2: Verify the formatter stays clean

**Files:**
- Modify: `src/features/pos/lib/receipt-format.ts`
- Test: `tests/pos/receipt-formatting.spec.ts`

- [ ] **Step 1: Run targeted lint**

Run: `pnpm exec eslint src/features/pos/lib/receipt-format.ts tests/pos/receipt-formatting.spec.ts`
Expected: no lint errors

- [ ] **Step 2: Re-run targeted tests**

Run: `pnpm exec vitest run tests/pos/receipt-formatting.spec.ts --reporter=verbose`
Expected: PASS

- [ ] **Step 3: Commit verification state**

```bash
git add src/features/pos/lib/receipt-format.ts tests/pos/receipt-formatting.spec.ts
git commit -m "chore: verify compact receipt formatter"
```
