---
status: complete
quick_task: 260529-7uo
completed_on: 2026-05-29
code_commit: 7923c55
---

# Quick Task 260529-7uo Summary

## Outcome

- Semua modal dialog aplikasi yang memakai footer aksi sekarang memakai white cursor yang konsisten untuk aksi aktif.
- User bisa memindahkan pilihan tombol dialog dengan `ArrowLeft` dan `ArrowRight` pada area non-input, lalu mengeksekusi aksi terpilih dengan `Enter`.
- Dialog yang punya input tetap mempertahankan perilaku input lama, termasuk shortcut pindah unit di modal qty dan shortcut `Delete` di modal edit item keranjang.

## Files Changed

- `src/components/ui/dialog-actions.ts`
- `src/features/pos/components/pos-remove-dialog.tsx`
- `src/features/pos/components/pos-receipt-prompt.tsx`
- `src/features/pos/components/pos-qty-dialog.tsx`
- `src/features/pos/components/pos-cart-item-dialog.tsx`
- `src/features/pos/components/pos-payment-dialog.tsx`
- `src/features/inventory/components/negative-stock-warning.tsx`
- `src/features/inventory/components/product-form-dialog.tsx`
- `tests/pos/dialog-action-navigation.spec.tsx`
- `tests/sync/negative-stock-warning.spec.tsx`

## Verification

- `pnpm exec vitest run tests/pos/dialog-action-navigation.spec.tsx tests/pos/receipt-prompt-flow.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx tests/sync/negative-stock-warning.spec.tsx --reporter=verbose`
- `pnpm exec eslint src/components/ui/dialog-actions.ts src/features/pos/components/pos-remove-dialog.tsx src/features/pos/components/pos-receipt-prompt.tsx src/features/pos/components/pos-qty-dialog.tsx src/features/pos/components/pos-cart-item-dialog.tsx src/features/pos/components/pos-payment-dialog.tsx src/features/inventory/components/negative-stock-warning.tsx src/features/inventory/components/product-form-dialog.tsx tests/pos/dialog-action-navigation.spec.tsx tests/pos/receipt-prompt-flow.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx tests/sync/negative-stock-warning.spec.tsx`

## Notes

- `vitest` tetap lulus dengan warning `act(...)` yang sudah ada dari komponen dialog POS/Base UI lain.
