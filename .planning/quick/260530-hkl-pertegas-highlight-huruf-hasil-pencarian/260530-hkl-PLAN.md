# Quick Task 260530-hkl: pertegas highlight huruf hasil pencarian fuzzy agar jauh lebih terlihat di inventori, stock in, dan POS tanpa mengubah flow pencarian

## Scope

- Perkuat treatment visual untuk potongan `nama_produk` yang dimatch hasil fuzzy search.
- Tetap gunakan helper highlight terpusat agar inventori, stock in, dan POS berubah konsisten.
- Jangan ubah ranking, flow input, keyboard behavior, atau struktur data hasil pencarian.

## Must Have

- Huruf yang termatch terlihat jelas berbeda dari teks lain saat hasil pencarian dirender.
- Penekanan visual tetap ringan secara layout: tidak mengubah alur klik, fokus, atau pemilihan item.
- Semua layar yang memakai helper highlight mendapat perubahan yang sama tanpa patch terpisah.

## Verification

- Spec helper membuktikan highlight memakai emphasis yang lebih kuat.
- Spec UI inventori, stock in, dan POS tetap pass.
- Lint file yang disentuh pass.
- `pnpm build` tetap pass.
