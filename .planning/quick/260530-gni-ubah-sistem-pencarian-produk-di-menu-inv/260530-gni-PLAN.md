# Quick Task 260530-gni: ubah sistem pencarian produk di menu inventori, stock in dan POS dengan menggunakan pencarian kedekatan kata (fuzzy search) yang tolearan dengan typo, kata yang mirip, kata lompat, dll. Gunakan library external seperti fuse.js untuk mempermudah development. Pastikan proses pencarian produk tidak lambat dengan jumlah produk yang banyak. Tampilakan nama produk dengan text cetak tebal (bold) pada huruf yang terkandung di field search, urutkan berdasarkan nama produk yang paling dekat. Pastikan implementasi program dapat berjalan mulus di production dengan data existing. Pastikan implementasi tidak mengubah flow dan fitur yang berjalan saat ini.

## Scope

- Tambahkan util pencarian produk terpusat berbasis `fuse.js` agar pencarian inventori, stock in, dan POS punya perilaku fuzzy yang konsisten.
- Pertahankan alur existing: input query, navigasi keyboard POS, pemilihan produk, dan submit stock in tetap bekerja tanpa perubahan flow.
- Tambahkan highlight nama produk berdasarkan hasil match pada field `nama_produk` tanpa mengubah struktur data produk yang sudah ada.

## Must Have

- Query dengan typo ringan, kata terbalik, atau gabungan nama+SKU tetap menemukan produk yang paling relevan.
- Hasil pencarian di inventori, stock in, dan POS diurutkan berdasarkan kedekatan hasil, bukan `includes` sederhana.
- Highlight nama produk tampil tebal pada segmen yang dimatch oleh pencarian.
- Implementasi aman untuk data existing: tidak ada migrasi schema, tidak ada perubahan payload product, dan build production tetap lolos.

## Verification

- Spec util untuk typo tolerance, kata terbalik, ranking, dan match index lulus.
- Spec UI inventori, stock in, dan POS membuktikan sorting fuzzy dan highlight bold aktif tanpa memutus flow lama.
- Lint file yang berubah lulus.
- `pnpm build` lulus untuk memverifikasi bundling/type-check production.
