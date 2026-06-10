# Quick Task 260610-hfg: syncronisasi stock gagal, jumlah stok di inventory device 1 dan device 2 berbeda. Contoh di device 1 stock barang dijual sehingga -4, di device 2 yang baru membuka web bersih, stock barang masih 0

## Goal

Menyamakan stok hasil stock-out antar device dengan memastikan replay sinkronisasi server menerima stok akhir negatif yang memang sudah diizinkan oleh flow POS lokal.

## Must Haves

- Event `SALES_OUT` yang membuat stok menjadi negatif tetap di-ack oleh replay server.
- Produk server menyimpan stok negatif yang sama agar device baru yang sync dari nol menerima angka stok identik.
- Tambahkan regression test server-side untuk kasus stok `0 -> -4` agar bug tidak kembali.

## Tasks

1. Tambahkan failing test pada replay inventory server untuk membuktikan event stock-out yang menghasilkan stok negatif saat ini masih gagal di-sync.
2. Ubah logika replay server agar delta stok tetap diterapkan walau hasil akhirnya negatif, sambil mempertahankan ordering dan idempotency yang sudah ada.
3. Jalankan verifikasi test sync yang relevan dan rangkum hasilnya di artefak quick task.
