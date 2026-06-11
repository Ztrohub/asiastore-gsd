# Inventory Filter Drawer Design

**Date:** 2026-06-11

## Goal

Menambahkan filter inventory yang scalable untuk ekspansi field filter berikutnya, dengan alur apply eksplisit melalui drawer kanan dan tombol simpan.

## Approved UX

- Tombol filter diletakkan di sebelah kiri searchbar pada tab `Produk`.
- Tombol membuka drawer dari sebelah kanan.
- Drawer saat ini hanya memiliki satu field filter:
  - `Tipe produk`
  - opsi: `Semua`, `Marketplace`
- Field menggunakan bentuk dropdown di dalam drawer.
- Tombol `Simpan` berada di footer bawah drawer.
- Saat `Simpan` ditekan:
  - drawer ditutup
  - daftar inventory diperbarui berdasarkan filter yang dipilih
- Tombol filter menampilkan badge jumlah filter aktif.
- Filter hanya disimpan selama halaman inventory masih terbuka.

## State Model

- `appliedFilters` menentukan daftar inventory yang sedang tampil.
- `draftFilters` dipakai selama drawer terbuka.
- Menutup drawer tanpa simpan tidak mengubah `appliedFilters`.
- Badge aktif dihitung dari jumlah field filter yang nilainya tidak default.

## Scope

- Perubahan hanya pada UI inventory dan test inventory.
- Tidak ada perubahan API, database, sync, atau persistence lokal.
