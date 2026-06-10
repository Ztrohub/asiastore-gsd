/# Quick Task 260610-grp: stock di PoS tidak update setelah melakukan transaksi, harus ke menu lain dan kembali ke PoS baru update

## Goal

Membuat stok produk di layar POS langsung ter-refresh setelah checkout menulis stock-out lokal, tanpa perlu pindah menu atau reload halaman.

## Must Haves

- Setelah mutasi stock-out lokal tersimpan, daftar produk yang memakai `useProductCatalog()` menampilkan stok terbaru pada sesi yang sama.
- Perbaikan mengikuti pola offline-first yang sudah ada, tanpa menunggu polling 30 detik atau remount halaman.
- Tambahkan regression test yang menangkap bug refresh stok ini agar tidak kembali lagi.

## Tasks

1. Tambahkan test reproduksi untuk membuktikan hook katalog produk tidak boleh menahan snapshot lama setelah stock-out lokal.
2. Implementasikan propagasi refresh katalog produk saat mutasi stok lokal berhasil disimpan.
3. Jalankan verifikasi test inventory/POS yang relevan lalu rangkum hasilnya di artefak quick task.
