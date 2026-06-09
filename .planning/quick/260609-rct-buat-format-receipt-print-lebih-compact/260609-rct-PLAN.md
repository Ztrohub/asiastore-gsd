# Quick Task 260609-rct: buat receipt menjadi lebih compact

## Goal

Membuat hasil print receipt 58mm jauh lebih pendek daripada format saat ini tanpa mengurangi field apa pun dan tanpa memotong nama item atau informasi lain.

## Must Haves

- Semua field yang saat ini dicetak tetap ada pada hasil akhir.
- Nama item, footer, dan teks panjang lain tetap terbaca penuh melalui wrapping, bukan dipotong.
- Layout receipt baru lebih ringkas secara signifikan dibanding format lama.
- Formatter receipt tetap kompatibel dengan flow print yang sudah ada.

## Tasks

1. Tambahkan test formatter yang membandingkan output baru dengan layout lama sebagai baseline panjang receipt.
2. Rapikan `src/features/pos/lib/receipt-format.ts` agar header, item, total, dan footer lebih padat tanpa truncation.
3. Jalankan test dan lint terarah untuk memverifikasi perubahan.
