# Marketplace Icon Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible `Marketplace` badge text with an icon-only outline badge placed to the right of marketplace product names in the inventory table.

**Architecture:** Keep the change local to the inventory product-name cell so the existing product data flow, search behavior, and inventory filters stay untouched. Update the inventory product tab contract test first to assert the new DOM order and the accessible label for the icon-only badge.

**Tech Stack:** React 19, Next.js app router, lucide-react, existing `Badge` UI component, Vitest, Testing Library

---

### Task 1: Update the regression test for the icon-only badge layout

**Files:**
- Modify: `tests/inventory/inventory-product-tab.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("shows an icon-only marketplace badge on the right side for marketplace products", () => {
  render(<InventoryTabs />);

  const tehCell = screen.getByText("Teh Tarik").closest("td");
  const susuCell = screen.getByText("Kopi Susu").closest("td");
  const tubrukCell = screen.getByText("Kopi Tubruk").closest("td");

  expect(screen.queryByText("Marketplace")).not.toBeInTheDocument();
  expect(within(tehCell!).getByLabelText("Produk marketplace")).toBeInTheDocument();
  expect(within(susuCell!).getByLabelText("Produk marketplace")).toBeInTheDocument();
  expect(within(tubrukCell!).queryByLabelText("Produk marketplace")).not.toBeInTheDocument();
  expect((tehCell!.firstElementChild as HTMLElement).lastElementChild).toHaveAttribute(
    "aria-label",
    "Produk marketplace",
  );
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: FAIL because the current badge still renders visible text and appears before the product name.

### Task 2: Render the right-aligned icon-only badge in the product table

**Files:**
- Modify: `src/features/inventory/components/product-table.tsx`

- [ ] **Step 1: Add the minimal UI implementation**

```tsx
<div className="flex flex-wrap items-center gap-2">
  <span>
    {highlightMatchedText(
      result.product.nama_produk,
      getProductMatchIndices(result.matches, "nama_produk"),
    )}
  </span>
  {result.product.is_marketplace ? (
    <Badge
      aria-label="Produk marketplace"
      className="shrink-0 px-1.5"
      title="Produk marketplace"
      variant="outline"
    >
      <Store aria-hidden="true" />
    </Badge>
  ) : null}
</div>
```

- [ ] **Step 2: Re-run the targeted test and verify it passes**

Run: `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: PASS for the updated icon-only badge contract and no regression in the existing inventory product tab tests.

### Task 3: Run final verification for the touched scope

**Files:**
- Modify if needed: `.planning/quick/260611-h6w-hapus-tulisan-marketplace-hanya-icon-saj/260611-h6w-SUMMARY.md`
- Modify if needed: `.planning/STATE.md`

- [ ] **Step 1: Run inventory tests**

Run: `pnpm exec vitest run tests/inventory --reporter=verbose`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Run lint for touched files**

Run: `pnpm exec eslint src/features/inventory/components/product-table.tsx tests/inventory/inventory-product-tab.spec.tsx`

Expected: PASS with zero lint errors.

- [ ] **Step 3: Run the production build**

Run: `pnpm build`

Expected: PASS with a successful Next.js build.
