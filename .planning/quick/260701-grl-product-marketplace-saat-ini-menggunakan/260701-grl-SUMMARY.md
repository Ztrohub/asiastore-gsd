---
status: complete
quick_task: 260701-grl
completed_on: 2026-07-01
code_commit: 035cb30
---

# Quick Task 260701-grl Summary

## Outcome

- Flow marketplace inventory sekarang SKU-only: form produk tidak lagi meminta `ID produk marketplace` untuk unit kecil maupun besar.
- Tab export marketplace menghapus field `Kolom ID Produk` dan hanya mencocokkan row workbook berdasarkan `ID SKU marketplace`.
- Util export tetap mendukung SKU marketplace unit kecil dan besar, termasuk penulisan stok unit besar dari `stok_unit_besar_saat_ini`.
- Runtime client/server berhenti mewajibkan product ID marketplace, tetapi kolom deprecated di database production tetap dipertahankan agar data existing aman.
- Prisma migration baru bersifat non-destruktif: hanya menandai kolom lama sebagai deprecated lewat komentar Postgres.

## Files Changed

- `prisma/migrations/20260701052000_soft_deprecate_marketplace_product_ids/migration.sql`
- `src/app/api/inventory/products/route.ts`
- `src/features/inventory/components/inventory-tabs.tsx`
- `src/features/inventory/components/marketplace-stock-tab.tsx`
- `src/features/inventory/components/product-form-dialog.tsx`
- `src/features/inventory/lib/marketplace-stock-config.ts`
- `src/features/inventory/lib/marketplace-stock-template.ts`
- `src/lib/inventory/marketplace.ts`
- `tests/inventory/inventory-product-tab.spec.tsx`
- `tests/inventory/marketplace-stock-template.spec.ts`
- `tests/inventory/product-catalog-sync.spec.ts`
- `tests/inventory/product-catalog-upsert-server.spec.ts`
- `tests/inventory/product-route-validation.spec.ts`

## Verification

- `pnpm exec vitest run tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-upsert-server.spec.ts tests/inventory/product-catalog-sync.spec.ts tests/inventory/marketplace-stock-template.spec.ts tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`
- `pnpm exec eslint src/app/api/inventory/products/route.ts src/features/inventory/components/inventory-tabs.tsx src/features/inventory/components/marketplace-stock-tab.tsx src/features/inventory/components/product-form-dialog.tsx src/features/inventory/lib/marketplace-stock-config.ts src/features/inventory/lib/marketplace-stock-template.ts src/lib/inventory/marketplace.ts tests/inventory/inventory-product-tab.spec.tsx tests/inventory/marketplace-stock-template.spec.ts tests/inventory/product-catalog-sync.spec.ts tests/inventory/product-catalog-upsert-server.spec.ts tests/inventory/product-route-validation.spec.ts`
- `pnpm build`
- `pnpm exec prisma validate`

## Notes

- `pnpm test` masih gagal pada `tests/sync/server-replay-order.spec.ts` karena test tersebut membutuhkan koneksi database Neon dan timeout saat server database tidak bisa dijangkau. Kegagalan ini tidak bersinggungan dengan perubahan SKU-only di inventory/export marketplace.
