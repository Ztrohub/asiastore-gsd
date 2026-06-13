# Quick Task 260613-ib9 Context

## Goal

Menambahkan fitur update stok marketplace dari file Excel `.xlsx` di tab `Marketplace` pada halaman inventori, tanpa mempengaruhi alur inventori lain dan tanpa menyimpan file ke storage atau database.

## Locked Decisions

- Surface fitur: tab baru bernama `Marketplace` di halaman `Inventori`.
- Processing mode: client-only di browser; file dibaca, diproses, dan diunduh kembali dari memory.
- Persistence: tidak menyimpan file ke storage, database, Dexie, Prisma, atau API server.
- Source data: hanya membaca katalog produk yang sudah ada di aplikasi.
- Matching key: pasangan `marketplace_product_id` + `marketplace_sku_id`.
- Stock source: hitung dari `stok_saat_ini` saja.
- Stock formula: `ceil(stok_saat_ini * persentase / 100)`.
- Default percentage: `30`.
- Template scope: hanya sheet pertama.
- Template rows: row sebelum `start row` tidak boleh disentuh.
- Default start row: `4`.
- Default column mapping:
  - ID Produk: `B`
  - ID SKU: `E`
  - Stok: `I`
- Mapping configurability: user bisa mengubah kolom ID Produk, ID SKU, kolom Stok, dan `start row` jika template berubah.
- Mismatch behavior: jika pasangan ID Produk + ID SKU tidak cocok, tulis stok `0`.
- Row behavior: tidak menambah row baru, tidak menghapus row, tidak mengubah urutan row.
- File support: `.xlsx` saja.

## Constraints

- Perubahan harus terisolasi agar tidak mengganggu tab `Produk` dan `Stock In`.
- Header template saat ini berjumlah 3 row di atas tabel, dan tetap aman karena processing baru mulai dari `start row`.
