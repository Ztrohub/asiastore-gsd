# Marketplace Product Badge Design

**Date:** 2026-06-11

## Goal

Menambahkan penanda visual yang jelas di daftar produk inventory untuk produk yang terdaftar di marketplace, tanpa mengganggu keterbacaan tabel atau alur pencarian yang sudah ada.

## Approved UX

- Penanda hanya tampil untuk produk dengan `is_marketplace === true`.
- Penanda diletakkan inline di kolom `Nama produk`, di sebelah kanan nama produk.
- Bentuk penanda adalah badge mini `outline` berisi ikon `Store` saja tanpa teks yang terlihat.
- Badge memakai gaya `outline` agar tetap jelas tetapi tidak lebih dominan dari isi tabel utama.
- Nama produk tetap menjadi elemen utama yang paling mudah dipindai di tabel.
- Highlight hasil pencarian tetap hanya mengenai nama produk, bukan badge.

## Component Behavior

- Badge dirender di level tabel produk, bukan di data model atau API response.
- Produk non-marketplace tidak menampilkan placeholder atau ruang kosong tambahan selain layout inline normal.
- Penanda tetap terlihat baik saat nama produk terkena highlight fuzzy-search.
- Layout nama produk dan badge tetap satu baris saat ruang cukup, tetapi boleh membungkus secara natural di layar sempit.

## Accessibility

- Walau badge tidak menampilkan teks yang terlihat, ia tetap memiliki label aksesibel seperti `Produk marketplace`.
- Ikon tetap dapat ditandai dekoratif terhadap label aksesibel badge agar screen reader tidak membaca nama ikon.

## Scope

- Perubahan hanya pada UI tabel produk inventory dan test inventory terkait.
- Tidak ada perubahan API, database, Prisma migration, sync, atau filter state.
