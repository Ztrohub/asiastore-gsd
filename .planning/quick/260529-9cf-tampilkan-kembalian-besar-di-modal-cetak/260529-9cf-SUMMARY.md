---
status: complete
quick_task: 260529-9cf
completed_on: 2026-05-29
code_commit: aecd8fe
---

# Quick Task 260529-9cf Summary

## Outcome

- Modal `Cetak receipt?` sekarang menampilkan nominal kembalian dengan font besar untuk transaksi tunai.
- Nilai yang ditampilkan diambil langsung dari `change_amount` pada transaksi hasil checkout, sehingga mengikuti input `uang diterima` yang dipakai kasir saat pembayaran.
- Untuk transaksi non-tunai, blok kembalian tidak ditampilkan.

## Files Changed

- `src/features/pos/components/pos-receipt-prompt.tsx`
- `src/features/pos/components/pos-screen.tsx`
- `tests/pos/receipt-prompt-flow.spec.tsx`

## Verification

- `pnpm exec vitest run tests/pos/receipt-prompt-flow.spec.tsx tests/pos/dialog-action-navigation.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx --reporter=verbose`
- `pnpm exec eslint src/features/pos/components/pos-receipt-prompt.tsx src/features/pos/components/pos-screen.tsx tests/pos/receipt-prompt-flow.spec.tsx tests/pos/dialog-action-navigation.spec.tsx tests/pos/keyboard-cart-flow.spec.tsx`

## Notes

- `vitest` tetap lulus dengan warning `act(...)` yang sudah ada dari dialog POS/Base UI lain.
