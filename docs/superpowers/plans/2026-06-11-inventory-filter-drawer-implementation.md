# Inventory Filter Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a right-side inventory filter drawer with draft/apply behavior and an active-filter badge for marketplace-only filtering.

**Architecture:** Keep filtering local to `InventoryTabs` with separate draft and applied states so the existing product search flow stays unchanged. Reuse the shared `Sheet`, `Badge`, and native `select` patterns already present in the codebase.

**Tech Stack:** React 19, Next.js app router, existing shadcn/base-ui primitives, Vitest, Testing Library

---

### Task 1: Cover the drawer workflow with tests

**Files:**
- Modify: `tests/inventory/inventory-product-tab.spec.tsx`

- [ ] Add a failing test that opens the filter drawer, changes the dropdown to `Marketplace`, and asserts the list stays unchanged before `Simpan`.
- [ ] Run `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose` and verify the new test fails for the expected missing UI behavior.

### Task 2: Implement local filter state and drawer UI

**Files:**
- Modify: `src/features/inventory/components/inventory-tabs.tsx`
- Modify: `src/features/inventory/components/product-table.tsx`

- [ ] Add minimal applied/draft filter state in `InventoryTabs`, compute active filter count, and render a filter button with badge beside the search input.
- [ ] Add a right-side `Sheet` with one dropdown field and a footer `Simpan` button that copies draft filters into applied filters and closes the drawer.
- [ ] Keep search behavior in `ProductTable`, but let `InventoryTabs` pass already-filtered products plus empty-state copy for filtered results if needed.

### Task 3: Verify the feature end-to-end

**Files:**
- Modify if needed: `.planning/quick/260611-gfb-tambahkan-tombol-filter-di-sebelah-kiri-/260611-gfb-SUMMARY.md`

- [ ] Run `pnpm exec vitest run tests/inventory --reporter=verbose`.
- [ ] Run `pnpm exec eslint src/features/inventory/components/inventory-tabs.tsx src/features/inventory/components/product-table.tsx tests/inventory/inventory-product-tab.spec.tsx`.
- [ ] Run `pnpm build`.
