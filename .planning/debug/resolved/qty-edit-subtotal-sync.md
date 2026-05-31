---
status: resolved
trigger: "Edit qty barang dari 1 ke 2 tidak menaikkan subtotal; qty tambahan tercatat sebagai diskon item."
created: 2026-05-31
updated: 2026-05-31
---

# Symptoms

- expected_behavior: Subtotal item mengikuti `harga satuan x qty` sampai kasir mengubah subtotal akhir secara manual sebagai diskon.
- actual_behavior: Saat qty item keranjang diubah dari 1 ke 2, subtotal akhir tetap di nilai qty lama sehingga qty tambahan berubah menjadi `line_discount`.
- error_messages: Tidak ada error UI yang terlihat.
- timeline: Dilaporkan pada 2026-05-31.
- reproduction: Tambah item qty 1 ke keranjang, buka edit item, ubah qty menjadi 2 tanpa mengubah subtotal akhir, simpan.

# Current Focus

- hypothesis: `PosCartItemDialog` menginisialisasi `finalSubtotalInput` dari qty lama dan tidak menyinkronkannya lagi ketika `qtyInput` berubah, lalu `updateLineBySubtotal()` menerjemahkan subtotal lama itu menjadi diskon.
- test: Tambahkan regresi test yang mengubah qty item keranjang dari 1 ke 2 tanpa menyentuh subtotal akhir dan memastikan total keranjang menjadi Rp 24.000.
- expecting: Test gagal karena total akhir tetap Rp 12.000 dan selisihnya masuk ke `line_discount`.
- next_action: Selesai.

# Evidence

- timestamp: 2026-05-31 - Regresi test baru gagal dengan `Expected ... 24000, Received 12000` pada field `Subtotal Akhir Item`.
- timestamp: 2026-05-31 - Setelah fix, test regresi POS, dialog navigation, dan checkout payment seluruhnya pass.

# Eliminated

- hypothesis: `updateLineBySubtotal()` salah menghitung diskon dari subtotal baru.
  reason: Hook cart sudah benar; bug terjadi karena dialog mengirim `finalSubtotal` lama saat qty berubah.

# Resolution

- root_cause: State `finalSubtotalInput` di `PosCartItemDialog` tidak mengikuti perubahan `qtyInput` ketika subtotal belum diubah manual, sehingga subtotal qty lama diperlakukan sebagai subtotal final qty baru.
- fix: Tambahkan mode override manual pada dialog edit item. Saat subtotal masih mode otomatis, perubahan qty akan langsung menyinkronkan `finalSubtotalInput` ke `harga_satuan x qty`. Begitu subtotal berbeda dari total normal, dialog masuk mode manual dan berhenti auto-sync sampai subtotal kembali sama dengan total normal.
- verification:
  - `pnpm exec vitest run tests/pos/keyboard-cart-flow.spec.tsx -t "keeps item subtotal in sync with edited qty until the cashier overrides it"`
  - `pnpm exec vitest run tests/pos/keyboard-cart-flow.spec.tsx tests/pos/dialog-action-navigation.spec.tsx tests/pos/checkout-payment.spec.tsx --reporter=verbose`
  - `pnpm exec eslint src/features/pos/components/pos-cart-item-dialog.tsx tests/pos/keyboard-cart-flow.spec.tsx`
- files_changed:
  - `src/features/pos/components/pos-cart-item-dialog.tsx`
  - `tests/pos/keyboard-cart-flow.spec.tsx`
