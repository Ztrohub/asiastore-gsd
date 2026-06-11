# Quick Task 260611-guk: badge marketplace di nama produk inventory

## Goal

Menambahkan badge mini marketplace di sebelah nama produk pada daftar inventory untuk produk yang sudah ditandai `is_marketplace`.

## Must Haves

- Hanya produk marketplace yang menampilkan badge.
- Badge tampil inline di kolom `Nama produk`, di sebelah kiri nama produk.
- Badge berisi ikon `Store` dan label `Marketplace`.
- Highlight fuzzy-search tetap hanya mengenai nama produk.
- Perubahan tidak mengubah API, database, filter state, atau alur inventory lain.

## Tasks

1. Tambahkan failing test yang memastikan hanya produk marketplace yang menampilkan badge `Marketplace`.
2. Implementasikan badge inline di `ProductTable` dengan komponen `Badge` dan ikon `Store`.
3. Jalankan verifikasi segar pada test inventory, lint file terkait, dan build aplikasi.
