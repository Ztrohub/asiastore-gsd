---
status: complete
quick_task: 260610-hfg
completed_on: 2026-06-10
code_commit: uncommitted
---

# Quick Task 260610-hfg Summary

## Outcome

- Replay sinkronisasi inventory di server sekarang tetap meng-apply `SALES_OUT` walau stok akhir menjadi negatif.
- Device baru yang sync katalog dari server akan menerima stok negatif yang sama dengan device yang melakukan penjualan, sehingga angka stok antar device tidak lagi pecah untuk kasus `0 -> -4`.
- Replay berikutnya sekarang juga menghitung dari stok server yang memang sudah negatif, jadi kasus `-4 -> -7` tidak lagi diam-diam di-reset dari `0`.
- Route sync produk server tidak lagi menolak payload dengan stok unit besar negatif, sehingga kebijakan minus stock konsisten di seluruh jalur sync server yang relevan.
- Regression test baru mengunci kasus stok negatif server-side supaya perilaku ini tidak kembali rusak.

## Files Changed

- `src/app/api/inventory/products/route.ts`
- `src/lib/db/inventory-replay.ts`
- `tests/inventory/product-route-validation.spec.ts`
- `tests/sync/inventory-replay-decimal.spec.ts`
- `.planning/quick/260610-hfg-syncronisasi-stock-gagal-jumlah-stok-di-/260610-hfg-PLAN.md`

## Verification

- `pnpm exec vitest run tests/sync/inventory-replay-decimal.spec.ts --reporter=verbose`
- `pnpm exec vitest run tests/sync/inventory-replay-decimal.spec.ts tests/sync/server-replay-order.spec.ts tests/inventory/product-catalog-sync.spec.ts --reporter=verbose`
- `pnpm exec vitest run tests/sync/inventory-replay-decimal.spec.ts tests/inventory/product-route-validation.spec.ts tests/sync/server-replay-order.spec.ts tests/inventory/product-catalog-sync.spec.ts --reporter=verbose`
- `pnpm exec vitest run tests/sync --reporter=verbose`
- `pnpm exec vitest run tests/sync tests/inventory/product-route-validation.spec.ts --reporter=verbose`
- `pnpm exec eslint src/lib/db/inventory-replay.ts src/app/api/inventory/products/route.ts tests/sync/inventory-replay-decimal.spec.ts tests/inventory/product-route-validation.spec.ts`

## Notes

- Queue inventory yang sebelumnya sudah berstatus `failed` karena stok negatif tidak akan retry otomatis. Setelah patch ini terpasang, jalankan `Retry` atau `Retry Semua Gagal` sekali di halaman Queue Sync agar event lama ikut terkirim ulang.
