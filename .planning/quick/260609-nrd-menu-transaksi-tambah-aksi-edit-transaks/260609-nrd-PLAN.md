# Quick Task 260609-nrd Plan

Tambah aksi `Print ulang` dan `Edit transaksi` di menu transaksi dengan soft-delete, restore, dan audit trail edit/delete tanpa mengubah perilaku POS aktif.

## Must Haves

- Menu transaksi punya aksi `Print ulang` dan `Edit transaksi`.
- `Print ulang` selalu lewat popup konfirmasi lalu kirim ulang receipt ke printer thermal lewat jalur print yang sama.
- `Edit transaksi` membuka dialog yang bisa mengubah item, diskon item, diskon transaksi, catatan, metode pembayaran, dan jumlah dibayar.
- Dialog edit punya aksi `Hapus transaksi` dan `Aktifkan kembali` berbasis soft-delete.
- Saat transaksi ter-flag hapus, seluruh field edit disabled sampai diaktifkan kembali.
- Semua aksi penting memunculkan popup konfirmasi.
- Audit metadata tersimpan untuk edit dan delete: kapan, oleh user siapa.
- Migrasi additive-only dan kompatibel dengan data production existing.
- Flow POS aktif tidak berubah.

## Execution Notes

- Mulai dengan regression tests untuk histori transaksi, persistence transaksi, sync payload, dan print ulang.
- Tambah field additive di Prisma `PosTransaction` dan `PosTransactionLine` bila perlu untuk soft-delete/audit/unit metadata.
- Tambah versi Dexie baru yang default-compatible dengan record lama.
- Pisahkan update transaksi histori dari checkout POS aktif; jangan ubah shortcut, dialog, atau checkout POS existing.
- Reuse komponen/dialog POS hanya jika perilaku POS aktif tetap identik dan regression test tetap hijau.
