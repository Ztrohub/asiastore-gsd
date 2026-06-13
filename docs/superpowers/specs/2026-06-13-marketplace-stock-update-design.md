# Marketplace Stock Update Design

**Date:** 2026-06-13

## Goal

Menambahkan fitur di halaman inventori untuk mengunggah template marketplace `.xlsx`, mencocokkan data marketplace dengan katalog produk lokal, mengisi kolom stok di file, lalu langsung mengunduh file hasil tanpa menyimpan file ke storage, database, atau mengubah data produk aplikasi.

## Approved Business Rules

- Fitur muncul sebagai tab baru bernama `Marketplace` di halaman `Inventori`.
- File yang didukung pada scope ini hanya `.xlsx`.
- Proses memakai sheet pertama saja.
- Data template mulai diproses dari `start row` yang bisa diatur user.
- Semua row sebelum `start row` tidak boleh disentuh.
- Pencocokan produk memakai kombinasi `marketplace_product_id` dan `marketplace_sku_id`.
- Jika pasangan ID pada row template cocok dengan data produk marketplace di aplikasi, nilai stok ditulis dari stok lokal produk itu.
- Jika pasangan ID tidak cocok, kolom stok pada row tersebut diisi `0`.
- Sistem tidak menambah produk baru yang tidak ada di template, tidak membuat row baru, dan tidak mengubah urutan data template.
- Sistem hanya mengubah kolom stok yang dikonfigurasi; kolom lain pada template tetap dibiarkan apa adanya.
- Stok yang dipakai untuk perhitungan hanya `stok_saat_ini`.
- Rumus stok yang ditulis adalah `ceil(stok_saat_ini * persentase / 100)`.
- Persentase stok diinput user, default `30`, dan dapat diubah sebelum proses.

## Template Configuration

Fitur harus menyediakan field konfigurasi template yang editable agar perubahan format file marketplace tidak memerlukan perubahan kode:

- `Kolom ID Produk`, default `B`
- `Kolom ID SKU`, default `E`
- `Kolom Stok`, default `I`
- `Start Row`, default `4`
- `Persentase Stok`, default `30`

Konfigurasi export harus disimpan lokal di browser client pada device yang sama agar ketika user mengubah mapping kolom, `start row`, atau persentase stok, nilai tersebut otomatis dipakai lagi pada kunjungan berikutnya tanpa perlu input ulang. Persistensi ini tetap local-only dan tidak disimpan ke storage server, database aplikasi, atau sinkronisasi antar device.

Aturan validasi konfigurasi:

- Nama kolom harus berupa label kolom Excel seperti `A`, `B`, `I`, `AA`.
- `Start Row` harus bilangan bulat `>= 1`.
- `Persentase Stok` harus angka `>= 0`.

## UX Scope

- Tab `Marketplace` tampil sejajar dengan tab `Produk` dan `Stock In`.
- Isi tab mencakup:
  - upload file `.xlsx`
  - form konfigurasi template
  - tombol `Proses & Download`
  - ringkasan hasil proses
- Saat tab dibuka, form konfigurasi otomatis memuat nilai terakhir yang tersimpan lokal di browser; jika belum ada, gunakan default `B`, `E`, `I`, `4`, `30`.
- Ringkasan hasil minimal menampilkan:
  - jumlah row yang diperiksa
  - jumlah row yang match
  - jumlah row yang diisi `0`
  - nama file hasil
- Setelah proses selesai, browser mencoba mengunduh file hasil secara otomatis.
- Jika unduhan otomatis diblokir browser, UI tetap menyediakan tombol download ulang dari hasil yang sudah ada di memory.

## Architecture

Perubahan harus diisolasi ke area inventori tanpa menyentuh perilaku fitur lain:

- `InventoryTabs` hanya bertambah satu tab baru `Marketplace`.
- Seluruh UI dan state baru ditempatkan di komponen terpisah khusus marketplace stock update.
- Logika parsing workbook, validasi mapping kolom, pencocokan row, dan penulisan stok ditempatkan di util murni yang dapat dites tanpa UI.
- Persistensi konfigurasi export memakai penyimpanan browser lokal yang ringan dan terisolasi, bukan Dexie produk/inventory, agar fitur ini tidak ikut mempengaruhi alur data inventori lain.
- Komponen UI hanya mengorkestrasi:
  - pemilihan file
  - pembacaan data produk dari hook katalog produk yang sudah ada
  - pemanggilan util transform workbook
  - trigger download file hasil
- Implementasi Excel memakai library browser-compatible untuk baca/tulis `.xlsx` di client-side.

## Data Flow

1. User membuka tab `Marketplace`.
2. UI memuat konfigurasi export terakhir dari penyimpanan lokal browser, atau memakai default jika belum ada.
3. User memilih file `.xlsx`.
4. User memeriksa atau mengubah konfigurasi kolom, `start row`, dan persentase stok.
5. Saat konfigurasi diubah, nilai terbaru disimpan kembali ke penyimpanan lokal browser.
6. UI mengambil daftar produk dari katalog lokal yang sudah tersedia di halaman inventori.
7. Sistem membaca sheet pertama workbook.
8. Sistem memindai row mulai dari `start row` sampai row terakhir yang berisi data.
9. Untuk setiap row:
   - baca nilai `ID Produk` dan `ID SKU` dari kolom yang dikonfigurasi
   - normalisasi nilai sebagai string trim untuk pencocokan exact
   - cari produk marketplace dengan pasangan ID yang sama
   - jika match, hitung `ceil(stok_saat_ini * persentase / 100)` lalu tulis ke kolom stok
   - jika tidak match, tulis `0` ke kolom stok
   - biarkan seluruh sel lain pada row tersebut tetap seperti file asli
10. Workbook hasil dibuat kembali di browser.
11. File hasil diunduh tanpa menyimpan file sumber atau hasil ke backend.

## Error Handling

- Jika file belum dipilih, proses diblokir dengan pesan yang jelas.
- Jika ekstensi file bukan `.xlsx`, proses diblokir.
- Jika workbook gagal dibaca, user mendapat pesan error pembacaan file.
- Jika konfigurasi kolom atau `start row` tidak valid, proses diblokir sebelum workbook diproses.
- Jika penyimpanan lokal browser tidak bisa diakses, fitur tetap bisa dipakai dengan nilai form saat ini, tetapi konfigurasi tidak dipersistkan.
- Jika katalog produk marketplace lokal kosong, proses diblokir dengan pesan yang jelas karena tidak ada data untuk dicocokkan.
- Jika browser gagal auto-download, hasil proses tetap dipertahankan di memory agar user bisa menekan download ulang.

## Isolation Requirements

Fitur ini tidak boleh mempengaruhi fungsi lain aplikasi. Untuk itu:

- Tidak boleh ada write ke `offlineDb`.
- Tidak boleh ada write ke Prisma, route API inventori, sync queue, atau database lain.
- Tidak boleh ada perubahan perilaku pada tab `Produk` dan `Stock In` selain penambahan tab `Marketplace`.
- Tidak boleh ada coupling baru ke proses sinkronisasi inventory atau POS.
- Persistensi konfigurasi hanya boleh lokal ke browser client, tidak boleh masuk ke storage backend atau sinkronisasi aplikasi.

## Testing Scope

- Test util untuk konversi label kolom Excel ke index numerik.
- Test util untuk perhitungan stok dengan persentase dan pembulatan `ceil`.
- Test util untuk pencocokan pasangan `marketplace_product_id` + `marketplace_sku_id`.
- Test util untuk aturan mismatch yang menulis `0`.
- Test util untuk proteksi row sebelum `start row`.
- Test UI inventory untuk memastikan tab `Marketplace` tampil tanpa merusak tab `Produk` dan `Stock In`.
- Test UI untuk memastikan default konfigurasi (`B`, `E`, `I`, `4`, `30`) benar.
- Test UI untuk memastikan konfigurasi yang diubah tersimpan lokal dan dimuat kembali saat tab dibuka ulang.
- Test UI untuk memastikan proses diblokir ketika file belum dipilih atau konfigurasi invalid.
- Re-run suite inventory yang sudah ada untuk memastikan tidak ada regresi pada flow lama.

## Out Of Scope

- Dukungan `.xls`, `.csv`, atau multi-sheet processing.
- Penyimpanan template atau hasil proses ke storage/cloud/database.
- Sinkronisasi file hasil ke server.
- Penambahan produk baru dari template marketplace.
- Perubahan stok produk di database aplikasi akibat proses export ini.
