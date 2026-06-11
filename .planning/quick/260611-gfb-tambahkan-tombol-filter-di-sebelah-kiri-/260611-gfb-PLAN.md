# Quick Task 260611-gfb: drawer filter inventory untuk produk marketplace

## Goal

Menambahkan tombol filter di kiri searchbar inventory yang membuka drawer dari kanan, menyimpan pilihan filter secara draft sampai tombol simpan ditekan, lalu memfilter daftar produk inventory dan menampilkan badge jumlah filter aktif.

## Must Haves

- Tombol filter berada di sebelah kiri searchbar pada tab `Produk`.
- Klik tombol membuka drawer/sheet dari sisi kanan.
- Drawer memiliki satu field dropdown `Tipe produk` dengan opsi `Semua` dan `Marketplace`.
- Tombol `Simpan` di bagian bawah drawer menutup drawer dan baru saat itu menerapkan filter ke daftar inventory.
- Tombol filter menampilkan badge `1` saat filter aktif dan tidak menampilkan badge saat default `Semua`.
- State filter hanya berlaku selama halaman inventory masih terbuka, tanpa persistence ke refresh/storage.

## Tasks

1. Tambahkan failing tests untuk tombol filter, alur drawer draft-versus-applied, badge aktif, dan penyaringan produk marketplace setelah simpan.
2. Implementasikan state filter applied/draft, tombol filter + badge, drawer kanan, dan dropdown filter tipe produk tanpa mengubah flow search yang ada.
3. Jalankan verifikasi segar pada test inventory, lint file terkait, dan build aplikasi.
