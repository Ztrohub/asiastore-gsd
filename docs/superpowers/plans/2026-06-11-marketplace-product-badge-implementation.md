# Marketplace Product Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a compact marketplace badge beside the product name for inventory products marked as marketplace items.

**Architecture:** Keep the change local to the inventory product table so the existing product data flow, search behavior, and filter logic remain unchanged. Render the badge inline inside the product-name cell and cover the behavior through the existing inventory tab contract test file.

**Tech Stack:** React 19, Next.js app router, lucide-react, existing `Badge` UI component, Vitest, Testing Library

---

### Task 1: Add a failing regression test for marketplace badges

**Files:**
- Modify: `tests/inventory/inventory-product-tab.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("shows a marketplace badge only for marketplace products", () => {
  render(<InventoryTabs />);

  expect(screen.getAllByText("Marketplace")).toHaveLength(2);
  expect(screen.getByText("Teh Tarik").closest("td")).toHaveTextContent("Marketplace");
  expect(screen.getByText("Kopi Susu").closest("td")).toHaveTextContent("Marketplace");
  expect(screen.getByText("Kopi Tubruk").closest("td")).not.toHaveTextContent("Marketplace");
});
```

- [ ] **Step 2: Run the targeted test and verify it fails**

Run: `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: FAIL because the product table does not render any marketplace badge yet.

### Task 2: Render the inline marketplace badge in the product table

**Files:**
- Modify: `src/features/inventory/components/product-table.tsx`

- [ ] **Step 1: Add the minimal UI implementation**

```tsx
import { Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";

<TableCell>
  <div className="flex flex-wrap items-center gap-2">
    {result.product.is_marketplace ? (
      <Badge className="gap-1" variant="outline">
        <Store aria-hidden="true" />
        <span>Marketplace</span>
      </Badge>
    ) : null}
    <span>
      {highlightMatchedText(
        result.product.nama_produk,
        getProductMatchIndices(result.matches, "nama_produk"),
      )}
    </span>
  </div>
</TableCell>
```

- [ ] **Step 2: Re-run the targeted test and verify it passes**

Run: `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`

Expected: PASS for the new badge coverage and no regression in existing inventory product tab tests.

### Task 3: Run final verification for the touched scope

**Files:**
- Modify if needed: `.planning/quick/260611-guk-tambahkan-icon-di-sebelah-nama-produk-un/260611-guk-SUMMARY.md`
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
