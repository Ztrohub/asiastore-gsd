---
status: complete
quick_task: 260627-jeb
completed_on: 2026-06-27
code_commit: 56d0e99
---

# Quick Task 260627-jeb Summary

## Outcome

- Menambahkan dukungan metadata marketplace terpisah untuk unit besar tanpa mengubah perilaku field marketplace lama untuk unit kecil/legacy.
- Form inventory sekarang bisa menyimpan ID produk marketplace dan ID SKU marketplace khusus unit besar ketika produk memiliki konfigurasi unit besar.
- Sync katalog produk server/offline tetap backward compatible: payload lama tetap aman, payload baru membawa field unit besar, dan fallback server tetap mempertahankan metadata existing saat field baru belum dikirim.
- Export Excel marketplace sekarang bisa match ke SKU marketplace unit kecil maupun unit besar, lalu memakai stok dari unit yang sesuai (`stok_saat_ini` untuk kecil, `stok_unit_besar_saat_ini` untuk besar).
- Prisma schema diperluas dengan dua kolom nullable baru untuk identitas marketplace unit besar.

## Files Changed

- `prisma/schema.prisma`
- `prisma/migrations/20260627071500_add_marketplace_large_uom_fields/migration.sql`
- `src/app/api/inventory/products/route.ts`
- `src/features/inventory/components/inventory-tabs.tsx`
- `src/features/inventory/components/marketplace-stock-tab.tsx`
- `src/features/inventory/components/product-form-dialog.tsx`
- `src/features/inventory/hooks/use-product-catalog.ts`
- `src/features/inventory/lib/marketplace-stock-template.ts`
- `src/lib/db/product-catalog.ts`
- `src/lib/inventory/marketplace.ts`
- `src/lib/offline/db.ts`
- `src/lib/offline/inventory-sync-transport.ts`
- `src/lib/offline/inventory-sync.ts`
- `tests/inventory/inventory-product-tab.spec.tsx`
- `tests/inventory/marketplace-stock-template.spec.ts`
- `tests/inventory/product-catalog-sync.spec.ts`
- `tests/inventory/product-catalog-upsert-server.spec.ts`
- `tests/inventory/product-route-validation.spec.ts`

## Verification

- `pnpm exec vitest run tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-sync.spec.ts tests/inventory/product-catalog-upsert-server.spec.ts tests/inventory/marketplace-stock-template.spec.ts tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`
- `pnpm exec prisma generate`
- `pnpm exec eslint src/app/api/inventory/products/route.ts src/features/inventory/components/product-form-dialog.tsx src/features/inventory/components/inventory-tabs.tsx src/features/inventory/components/marketplace-stock-tab.tsx src/features/inventory/hooks/use-product-catalog.ts src/features/inventory/lib/marketplace-stock-template.ts src/lib/db/product-catalog.ts src/lib/inventory/marketplace.ts src/lib/offline/db.ts src/lib/offline/inventory-sync-transport.ts src/lib/offline/inventory-sync.ts tests/inventory/product-route-validation.spec.ts tests/inventory/product-catalog-sync.spec.ts tests/inventory/product-catalog-upsert-server.spec.ts tests/inventory/marketplace-stock-template.spec.ts tests/inventory/inventory-product-tab.spec.tsx`
- `pnpm exec vitest run tests/inventory --reporter=verbose`
- `pnpm build`

## Notes

- `pnpm exec prisma migrate dev --name add_marketplace_large_uom_fields` tidak bisa dijalankan di environment ini karena koneksi ke database Neon gagal (`P1001`), jadi SQL migration dibuat dari diff schema lokal lalu disimpan sebagai migration Prisma di repo.
