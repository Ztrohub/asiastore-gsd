---
status: resolved
trigger: "Edit produk di inventory pada tablet Android Chrome mode landscape terpotong di bagian atas dan tombol save hanya terlihat sedikit sehingga sulit diklik."
created: 2026-06-27
updated: 2026-06-27
---

# Symptoms

- expected_behavior: Dialog edit produk inventory tampil utuh pada tablet landscape dan tombol `Simpan Produk` bisa ditekan tanpa perlu scroll sampai footer keluar layar.
- actual_behavior: Bagian atas dialog terpotong dan footer aksi ikut terdorong ke bawah viewport; pada simulasi `1024x600` tombol save tidak terlihat (`saveVisible: false`, `saveBox.y: 916`).
- error_messages: Tidak ada error runtime UI; masalah murni layout responsif.
- timeline: Dilaporkan pada 2026-06-27.
- reproduction: Buka inventory, pilih edit produk, lalu lihat pada Chrome Android tablet landscape dengan tinggi viewport pendek.

# Current Focus

- hypothesis: `DialogContent` membungkus seluruh form sebagai satu panel scroll yang tetap dipusatkan secara vertikal, sehingga header dan footer ikut terdorong saat tinggi layar landscape pendek.
- test: Tambahkan regresi test yang memastikan area scroll hanya membungkus isi form, sementara footer aksi tetap berada di luar scroll region.
- expecting: Test awal gagal karena belum ada `product-form-scroll-region` dan footer save masih berada di dalam kontainer scroll.
- next_action: Selesai.

# Evidence

- timestamp: 2026-06-27 - Reproduksi Playwright pada `1024x600` dan `1280x800` menunjukkan tombol save di luar viewport (`saveVisible: false`) sebelum fix.
- timestamp: 2026-06-27 - Setelah fix, Playwright pada `1024x600` dan `1280x800` menunjukkan header tetap terlihat dan tombol save kembali masuk viewport (`saveVisible: true`).
- timestamp: 2026-06-27 - Regresi test `keeps inventory product actions outside the scroll region for short viewports` fail sebelum perubahan dan pass setelah struktur dialog dipisah.

# Eliminated

- hypothesis: Masalah berasal dari browser Chrome Android yang salah menghitung `vh`.
  reason: Penyebab utama ada di struktur dialog; begitu popup di-top-anchor, memakai `100dvh`, dan footer dipisah dari scroll region, layout stabil tanpa perubahan browser-specific hack tambahan.

# Resolution

- root_cause: `product-form-dialog` memakai `DialogContent` ber-`overflow-y-auto` untuk seluruh form dan tetap diposisikan di tengah layar. Pada viewport landscape pendek, seluruh konten termasuk footer aksi ikut discroll dan tombol save jatuh ke luar area pandang.
- fix: Ubah dialog menjadi kontainer `flex` yang di-anchor ke atas dengan `top-4`, `max-h-[calc(100dvh-2rem)]`, `overflow-hidden`, lalu pindahkan body form ke scroll region terpisah (`data-testid="product-form-scroll-region"`) dan biarkan header/footer sebagai area tetap di luar scroll.
- verification:
  - `pnpm exec vitest run tests/inventory/inventory-product-tab.spec.tsx --reporter=verbose`
  - `pnpm exec vitest run tests/inventory --reporter=verbose`
  - `pnpm exec eslint src/features/inventory/components/product-form-dialog.tsx tests/inventory/inventory-product-tab.spec.tsx`
  - `pnpm build`
  - Validasi Playwright manual pada viewport `1024x600` dan `1280x800`
- files_changed:
  - `src/features/inventory/components/product-form-dialog.tsx`
  - `tests/inventory/inventory-product-tab.spec.tsx`
