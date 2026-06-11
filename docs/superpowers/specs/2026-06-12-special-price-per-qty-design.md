# Special Price Per Qty Design

**Date:** 2026-06-12

## Goal

Menambahkan harga khusus per qty pada master produk yang otomatis dipakai saat transaksi POS, tetap bekerja offline, tersinkron ke server, dan menggunakan Prisma migration untuk setiap perubahan struktur database.

## Approved Pricing Rules

- Harga dasar produk tetap berarti harga untuk `qty 1.0`.
- Harga khusus disimpan sebagai harga final untuk chunk qty tertentu, bukan tarif per unit. Contoh: `0.5 => 6000`.
- Sistem tetap hanya menerima qty dengan `1 angka desimal`.
- Harga khusus hanya valid untuk qty `< 1.0` dan kelipatan `0.1`.
- Jika ada rule exact untuk pecahan yang sedang dihitung, rule exact wajib dipakai dan tidak boleh dipecah ke kombinasi chunk yang lebih kecil.
- Jika tidak ada rule exact, sistem boleh memakai kombinasi harga khusus yang totalnya tidak melebihi pecahan qty yang sedang dihitung.
- Jika setelah memakai harga khusus masih ada sisa pecahan yang tidak tertutup rule, sisa tersebut dihitung prorata dengan harga dasar.

## Pricing Resolution Behavior

- Total qty dipisah menjadi bagian bulat dan bagian pecahan.
- Bagian bulat dihitung langsung dengan harga dasar: `integer_qty x harga_dasar`.
- Bagian pecahan diselesaikan dengan resolver harga khusus.
- Resolver pecahan bekerja dengan prioritas:
  - pakai rule exact jika tersedia
  - jika tidak ada, pilih kombinasi rule yang menutup pecahan terbanyak
  - jika coverage sama, pilih jumlah chunk paling sedikit
  - jika masih sama, pilih chunk lebih besar lebih dulu
- Sisa pecahan yang tidak tertutup rule khusus dihitung dengan harga dasar prorata per `0.1`.

## Examples

- Dasar `1.0 => 10000`, rule `0.5 => 6000`
  - `qty 1.5 = 10000 + 6000 = 16000`
  - `qty 1.6 = 10000 + 6000 + (0.1 x 10000) = 17000`
- Jika tersedia `0.4 => 4700` dan `0.2 => 2500`
  - `qty 0.4` wajib memakai `4700`, bukan `2 x 0.2`
- Qty seperti `0.25` tidak valid pada desain ini karena sistem tetap dibatasi ke `1 angka desimal`

## Product Master Data

- Produk memperoleh daftar harga khusus per unit jual.
- Setiap rule harga khusus menyimpan:
  - unit jual target, misalnya `SMALL` atau `LARGE`
  - `qty_tenths` integer untuk mewakili kelipatan `0.1`
  - harga final untuk chunk qty tersebut
- Harga dasar yang sudah ada tetap menjadi sumber harga untuk `qty 1.0`.
- Rule harga khusus hanya boleh disimpan untuk unit yang memang diizinkan dijual.
- Tidak boleh ada dua rule untuk kombinasi produk, unit, dan qty yang sama.

## POS Transaction Behavior

- Saat cashier memilih produk dan qty, subtotal item dihitung dari pricing resolver, bukan lagi dari `unit_price x qty`.
- Keranjang tetap menyimpan `unit_price` dasar untuk unit yang dipilih agar transaksi lama dan tampilan existing tetap kompatibel.
- Selain field transaksi yang sudah ada, setiap line transaksi juga harus menyimpan snapshot perhitungan harga yang dipakai saat checkout.
- Snapshot line minimal mencakup:
  - harga dasar unit saat transaksi terjadi
  - daftar rule harga khusus yang berlaku untuk line tersebut saat transaksi terjadi
  - breakdown chunk yang dipilih resolver
  - subtotal otomatis sebelum override manual
- Edit item keranjang tetap boleh override subtotal akhir, tetapi batas atas override mengikuti subtotal otomatis hasil resolver.

## Transaction History And Reprint

- Edit transaksi histori untuk line yang sudah ada harus menghitung ulang subtotal item memakai snapshot harga yang tersimpan pada line tersebut, bukan harga master produk terbaru.
- Jika user menambahkan line baru saat edit transaksi histori, line baru memakai harga dasar dan rule harga khusus dari master produk yang aktif saat edit dilakukan.
- Receipt dan tampilan histori tidak boleh lagi mengasumsikan bahwa `qty x unit_price` selalu sama dengan subtotal line.
- Jika line memakai kombinasi harga khusus, tampilan detail line harus tetap menampilkan subtotal final yang benar walau ada selisih dari harga dasar.
- Snapshot harga pada line transaksi menjadi sumber kebenaran untuk reprint dan sync agar hasil cetak tetap konsisten dengan transaksi awal.

## Sync And Offline Requirements

- Struktur harga khusus harus ikut ke:
  - Prisma schema dan migration
  - API inventory products
  - cache Dexie `products`
  - payload sync inventory product online dan offline
- Device offline harus tetap bisa menghitung subtotal otomatis dari data lokal tanpa bergantung ke server.
- Sync produk harus memperlakukan perubahan harga khusus sebagai perubahan katalog produk biasa.
- Transaksi yang tersimpan offline harus membawa snapshot harga line sehingga server dan device lain menerima hasil final yang sama.

## Validation Rules

- Qty rule harga khusus harus:
  - lebih dari `0`
  - kurang dari `1.0`
  - kelipatan `0.1`
- Harga rule harus integer IDR dan mengikuti batas validasi harga produk yang sudah ada.
- Rule duplicate untuk unit dan qty yang sama harus ditolak.
- Jika unit besar tidak aktif untuk penjualan, rule unit besar tidak boleh disimpan.
- Payload API yang mencoba mengirim qty dengan lebih dari `1 angka desimal` harus ditolak.

## UI Scope

- Form master produk mendapat area baru untuk mengelola harga khusus per qty.
- Cashier tidak perlu memilih rule secara manual di POS; perhitungan berjalan otomatis dari qty yang diinput.
- Dialog edit item keranjang tetap menjadi tempat override subtotal manual, bukan tempat mengubah master rule harga khusus.
- Di POS, line item yang memakai harga campuran harus menampilkan breakdown harga sebagai baris terpisah per komponen yang dipakai resolver.
- Contoh untuk `qty 1.6` dengan dasar `10000` dan rule `0.5 => 6000`, tampilan item menjadi:
  - `1.1 x 10.000`
  - `0.5 x 6.000`
  - subtotal item tetap `17.000`

## Receipt Scope

- Receipt mengikuti breakdown harga yang sama seperti POS bila line memakai harga campuran.
- Untuk contoh `qty 1.6`, detail item pada receipt ditampilkan sebagai:
  - `1.1 x 10.000`
  - `0.5 x 6.000`
  - `Sub 17.000`
- Receipt tidak perlu mencetak seluruh rule master produk; hanya breakdown yang benar-benar dipakai transaksi itu.

## Data Model Scope

- Perubahan struktur database harus dilakukan dengan Prisma migration, bukan `db push`.
- Dibutuhkan penyimpanan rule harga khusus di master produk.
- Dibutuhkan penyimpanan snapshot pricing pada line transaksi untuk menjaga konsistensi sync, histori, dan receipt.

## Testing Scope

- Tambah test unit untuk resolver harga khusus.
- Tambah test validasi route produk untuk rule harga khusus.
- Tambah test sync katalog produk untuk memastikan rule ikut tersimpan dan tersinkron.
- Tambah test POS checkout dan edit transaksi untuk subtotal otomatis exact-first dan sisa prorata.
- Tambah test receipt atau detail transaksi untuk memastikan subtotal line tetap benar saat memakai harga khusus.

## Out Of Scope

- Dukungan qty `2 angka desimal` atau rule seperti `0.25`.
- Rule harga khusus untuk qty `>= 1.0`.
- Pemilihan manual rule harga oleh cashier saat checkout.
