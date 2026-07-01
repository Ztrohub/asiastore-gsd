# Marketplace SKU-Only Design

**Date:** 2026-07-01

## Goal

Menghapus penggunaan aktif `ID produk marketplace` dari inventory dan menu export marketplace, sambil mempertahankan kolom lama di database production sebagai data deprecated yang tidak dipakai lagi oleh flow baru.

## Approved Rules

- Form inventory hanya meminta `Nama produk marketplace`, `ID SKU marketplace`, dan opsional `ID SKU marketplace unit besar`.
- `ID produk marketplace` kecil maupun besar tidak lagi tampil di UI inventory.
- Export marketplace hanya memakai pencocokan exact terhadap `marketplace_sku_id` atau `marketplace_large_sku_id`.
- Field konfigurasi `Kolom ID Produk` di tab marketplace dihapus.
- Kolom database `marketplace_product_id` dan `marketplace_large_product_id` tidak dihapus, tidak diwajibkan, dan tidak dipakai untuk matching export.
- Saat produk marketplace dinonaktifkan, seluruh metadata marketplace tetap dibersihkan termasuk kolom deprecated agar status data konsisten.

## Production Safety

- Rollout bersifat soft deprecate: schema Prisma tetap mempertahankan kolom lama sehingga data existing production tidak hilang.
- Migration Prisma hanya mendokumentasikan status deprecated kolom lama di Postgres, tanpa drop/rename/backfill destruktif.
- Payload lama yang masih membawa `marketplace_product_id` tetap tidak memblokir sync; server dapat mengabaikan kebutuhan field tersebut sambil menjaga record existing tetap aman.

## Impacted Areas

- `src/lib/inventory/marketplace.ts`
- `src/features/inventory/components/product-form-dialog.tsx`
- `src/features/inventory/components/marketplace-stock-tab.tsx`
- `src/features/inventory/lib/marketplace-stock-config.ts`
- `src/features/inventory/lib/marketplace-stock-template.ts`
- `src/features/inventory/hooks/use-product-catalog.ts`
- `src/app/api/inventory/products/route.ts`
- `src/lib/db/product-catalog.ts`
- inventory tests dan Prisma migration baru
