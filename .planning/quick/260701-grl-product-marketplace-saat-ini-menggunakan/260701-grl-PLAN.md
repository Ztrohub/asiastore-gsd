# Quick Task 260701-grl: SKU-only marketplace identifiers

Goal:
Berpindah dari pencocokan marketplace berbasis `marketplace_product_id + marketplace_sku_id` menjadi SKU-only tanpa menghapus kolom deprecated dari database production.

Must haves:
- Form inventory tidak lagi menampilkan field `ID produk marketplace` kecil maupun besar.
- Validasi produk marketplace hanya mewajibkan `marketplace_product_name`, `marketplace_sku_id`, dan bila dipakai `marketplace_large_sku_id`.
- Export marketplace menghapus field `Kolom ID Produk` dan hanya mencocokkan row workbook berdasarkan SKU marketplace.
- Data deprecated `marketplace_product_id` dan `marketplace_large_product_id` tetap aman di database production dan tidak menjadi syarat runtime baru.
- Prisma migration bersifat non-destruktif dan aman untuk rollout production.

Implementation outline:
1. Ubah ekspektasi test inventory/export ke perilaku SKU-only lalu jalankan untuk memastikan fail.
2. Implementasikan perubahan pada util marketplace, form inventory, hook katalog produk, API route, export config, dan workbook matcher.
3. Tambahkan migration Prisma non-destruktif untuk soft deprecate kolom product ID marketplace di production.
4. Jalankan test terarah, lint terarah, dan build bila relevan sebelum finalisasi.
