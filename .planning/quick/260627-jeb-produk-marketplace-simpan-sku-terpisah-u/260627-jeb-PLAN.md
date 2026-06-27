# Quick Task 260627-jeb: marketplace SKU terpisah untuk unit kecil dan besar

## Goal

Menambahkan dukungan metadata marketplace terpisah untuk unit kecil dan unit besar pada produk yang sama, dengan rollout aman untuk data production existing serta tanpa regresi pada sync inventory, stock in, dan export Excel marketplace.

## Must Haves

- Produk marketplace tetap mendukung metadata unit kecil yang sudah ada sekarang.
- Produk dengan unit besar bisa menyimpan ID produk marketplace dan ID SKU marketplace khusus unit besar secara terpisah.
- Payload lama yang belum mengirim field unit besar tetap valid dan tidak menghapus data marketplace existing.
- Sync katalog produk server/offline tetap membawa metadata marketplace unit besar bila tersedia.
- Export Excel marketplace dapat mencocokkan SKU unit kecil maupun unit besar dan menulis stok dari unit yang sesuai.
- Perubahan database dilakukan lewat Prisma migration yang aman untuk production.

## Tasks

1. Tambahkan failing tests untuk validasi payload, persist/sync katalog produk, dan export workbook marketplace untuk metadata unit besar.
2. Implementasikan field marketplace unit besar di Prisma, normalisasi marketplace, alur upsert server, cache offline, dan transport sync dengan fallback legacy-safe.
3. Perluas form inventory dan util export marketplace agar user bisa mengisi mapping unit kecil/besar dan workbook memakai stok unit yang benar.
4. Jalankan verifikasi terarah, lalu tulis summary quick task dan update STATE.md.
