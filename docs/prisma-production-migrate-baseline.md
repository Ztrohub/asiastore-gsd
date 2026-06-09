# Prisma Migrate Baseline For Existing Production

Dokumen ini dipakai ketika database production sebelumnya dibuat dengan `prisma db push` dan belum memiliki histori `_prisma_migrations`.

## Tujuan

- Menambahkan histori migration Prisma tanpa mengubah data production yang sudah ada.
- Menjalankan migration decimal inventory sync setelah baseline berhasil ditandai sebagai `applied`.

## Migration Chain

1. `20260609164000_baseline_db_push_production`
   Baseline schema production lama sebelum perubahan decimal inventory.
   Migration ini **tidak dijalankan** ke production lama. Migration ini hanya ditandai sebagai `applied`.
2. `20260609165000_decimal_inventory_sync`
   Mengubah `InventoryMutationEvent.delta_qty`, `Product.stok_saat_ini`, dan `Product.stok_unit_besar_saat_ini` ke `DOUBLE PRECISION`.

## Langkah Production

1. Backup database production.
2. Deploy code aplikasi terbaru ke server, tapi jangan jalankan `db push`.
3. Tandai baseline sebagai sudah diterapkan:

```bash
pnpm exec prisma migrate resolve --applied 20260609164000_baseline_db_push_production
```

Perintah ini hanya menulis histori ke `_prisma_migrations`. Data tabel existing tidak diubah.

4. Jalankan migration yang benar-benar perlu dieksekusi:

```bash
pnpm exec prisma migrate deploy
```

Pada chain saat ini, yang dieksekusi ke database existing hanya `20260609165000_decimal_inventory_sync`.

5. Restart aplikasi jika deploy belum melakukannya otomatis.
6. Uji transaksi dengan qty pecahan, misalnya `0.5`.

## Validasi Setelah Deploy

Jalankan query berikut:

```sql
SELECT data_type
FROM information_schema.columns
WHERE table_name = 'InventoryMutationEvent'
  AND column_name = 'delta_qty';

SELECT data_type
FROM information_schema.columns
WHERE table_name = 'Product'
  AND column_name IN ('stok_saat_ini', 'stok_unit_besar_saat_ini');
```

Nilai yang diharapkan adalah `double precision`.

## Larangan

- Jangan jalankan `pnpm exec prisma migrate reset`.
- Jangan jalankan `pnpm exec prisma db push` di production setelah baseline migrate diadopsi.
- Jangan menjalankan baseline migration SQL secara manual pada database production existing, karena baseline itu mewakili state yang sudah ada.
