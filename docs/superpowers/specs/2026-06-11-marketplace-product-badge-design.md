# Marketplace Product Badge Design

**Date:** 2026-06-11

## Goal

Menambahkan penanda visual yang jelas di daftar produk inventory untuk produk yang terdaftar di marketplace, tanpa mengganggu keterbacaan tabel atau alur pencarian yang sudah ada.

## Approved UX

- Penanda hanya tampil untuk produk dengan `is_marketplace === true`.
- Penanda diletakkan inline di kolom `Nama produk`, di sebelah kiri nama produk.
- Bentuk penanda adalah badge mini dengan ikon `Store` dan label `Marketplace`.
- Badge memakai gaya `outline` agar tetap jelas tetapi tidak lebih dominan dari isi tabel utama.
- Highlight hasil pencarian tetap hanya mengenai nama produk, bukan badge.

## Component Behavior

- Badge dirender di level tabel produk, bukan di data model atau API response.
- Produk non-marketplace tidak menampilkan placeholder atau ruang kosong tambahan selain layout inline normal.
- Penanda tetap terlihat baik saat nama produk terkena highlight fuzzy-search.

## Accessibility

- Badge tetap menyertakan teks `Marketplace`, jadi statusnya tidak bergantung pada ikon saja.
- Ikon hanya bersifat dekoratif terhadap label badge dan tidak menjadi satu-satunya indikator.

## Scope

- Perubahan hanya pada UI tabel produk inventory dan test inventory terkait.
- Tidak ada perubahan API, database, Prisma migration, sync, atau filter state.
