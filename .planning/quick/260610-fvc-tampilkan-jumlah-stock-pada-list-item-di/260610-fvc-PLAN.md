# Quick Task 260610-fvc: tampilkan jumlah stock pada list item di PoS

## Goal

Menampilkan jumlah stok produk langsung pada setiap baris hasil pencarian POS agar kasir bisa melihat ketersediaan tanpa membuka menu inventory.

## Must Haves

- Setiap row item di daftar produk POS menampilkan stok saat ini.
- Jika produk punya unit besar, stok unit besar ikut terlihat tanpa mengubah aksi keyboard atau alur tambah item.
- Format stok tetap konsisten dengan helper quantity/UOM yang sudah ada di codebase.

## Tasks

1. Tambahkan regression test pada flow POS untuk membuktikan metadata stok muncul di row produk.
2. Implementasikan tampilan stok di `src/features/pos/components/pos-product-table.tsx` dengan helper inventory yang sudah ada.
3. Jalankan verifikasi segar pada test POS terkait agar perubahan UI tidak mengganggu flow keyboard.
