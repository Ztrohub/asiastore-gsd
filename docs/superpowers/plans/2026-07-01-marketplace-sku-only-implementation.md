# Marketplace SKU-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove active marketplace product-ID usage from inventory and marketplace export while keeping deprecated DB columns safe in production.

**Architecture:** Marketplace normalization and export matching move to SKU-only behavior. Deprecated product-ID columns remain in Prisma and Postgres, but current UI, validation, sync payload handling, and export config stop depending on them.

**Tech Stack:** Next.js, React, Vitest, Prisma, PostgreSQL, ExcelJS

---

### Task 1: Convert tests to SKU-only expectations

**Files:**
- Modify: `tests/inventory/product-route-validation.spec.ts`
- Modify: `tests/inventory/product-catalog-sync.spec.ts`
- Modify: `tests/inventory/product-catalog-upsert-server.spec.ts`
- Modify: `tests/inventory/marketplace-stock-template.spec.ts`
- Modify: `tests/inventory/inventory-product-tab.spec.tsx`

- [ ] Update tests so marketplace product ID is no longer required in form, route, or export config.
- [ ] Run targeted Vitest commands and confirm failures point to old product-ID behavior.

### Task 2: Implement runtime SKU-only behavior

**Files:**
- Modify: `src/lib/inventory/marketplace.ts`
- Modify: `src/features/inventory/components/product-form-dialog.tsx`
- Modify: `src/features/inventory/components/marketplace-stock-tab.tsx`
- Modify: `src/features/inventory/lib/marketplace-stock-config.ts`
- Modify: `src/features/inventory/lib/marketplace-stock-template.ts`
- Modify: `src/features/inventory/components/inventory-tabs.tsx`
- Modify: `src/features/inventory/hooks/use-product-catalog.ts`
- Modify: `src/app/api/inventory/products/route.ts`
- Modify: `src/lib/db/product-catalog.ts`

- [ ] Remove product-ID inputs/config from active UI and validation.
- [ ] Make workbook matching and marketplace listing lookup rely on SKU-only keys.
- [ ] Keep deprecated DB fields compatible for existing records while stopping active runtime dependence on them.

### Task 3: Add non-destructive Prisma migration and verify

**Files:**
- Add: `prisma/migrations/20260701000000_soft_deprecate_marketplace_product_ids/migration.sql`
- Modify if needed: `.planning/STATE.md`
- Add: `.planning/quick/260701-grl-product-marketplace-saat-ini-menggunakan/260701-grl-SUMMARY.md`

- [ ] Add a safe Prisma migration that documents deprecated marketplace product-ID columns without dropping data.
- [ ] Run targeted tests, targeted lint, and build or note if build is not run.
- [ ] Record summary and update quick-task state artifacts.
