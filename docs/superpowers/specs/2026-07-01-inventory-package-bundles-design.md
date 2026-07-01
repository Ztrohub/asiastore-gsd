# Inventory Package Bundles Design

**Date:** 2026-07-01

## Goal

Menambahkan fitur `Paket` di menu inventory untuk membuat produk gabungan dari beberapa produk existing, dengan stok dan harga paket selalu diturunkan dari komponen, dapat dijual di POS, dan dapat ikut flow export marketplace tanpa merusak alur inventory, POS, offline sync, maupun database production yang sudah berjalan.

## Recommended Approach

Gunakan model katalog yang tetap berpusat pada `Product`, lalu bedakan produk biasa dan paket lewat kolom jenis produk. Dengan pendekatan ini:

- tab `Produk`, `Stock In`, POS, sync, dan export marketplace tetap memakai katalog yang sama
- paket bisa punya identitas katalog sendiri (`nama`, `SKU internal`, metadata marketplace)
- stok dan harga paket tidak menjadi sumber kebenaran baru di database
- mutasi inventory server tetap berbasis komponen produk riil, bukan stok paket virtual

Pendekatan ini lebih aman dibanding membuat katalog paket terpisah atau membuat paket virtual murni di client.

## Approved Rules

- Inventory memiliki tab baru bernama `Paket`.
- Paket tidak muncul di tab `Produk`.
- Tab `Stock In` tetap hanya untuk produk stok riil dan tidak menerima paket.
- Paket punya `SKU internal`.
- Paket bisa ditandai dijual di marketplace seperti produk biasa.
- Untuk paket marketplace, field yang dibutuhkan hanya:
  - `Nama produk marketplace`
  - `ID SKU marketplace`
- Paket tidak punya `ID SKU marketplace unit besar`.
- Paket dijual sebagai `1 unit tetap`, bukan produk dengan varian unit kecil/besar sendiri.
- Komponen paket boleh memakai `unit kecil` maupun `unit besar`.
- Harga paket selalu otomatis mengikuti harga terbaru komponen.
- Stok paket selalu otomatis mengikuti stok komponen.
- Saat paket dijual di POS, stok yang berkurang adalah stok komponen sesuai resep paket.
- Saat histori transaksi paket diedit, didelete, atau direstore, stok komponen harus ikut direkonsiliasi kembali.

## UX Scope

### Inventory Tabs

- `Produk`
  - hanya menampilkan `Product` dengan jenis `NORMAL`
- `Stock In`
  - hanya bekerja untuk `Product` jenis `NORMAL`
- `Marketplace`
  - tetap ada
  - memakai stok turunan paket jika row marketplace mereferensikan paket
- `Paket`
  - tab baru untuk daftar dan form paket

### Package Form

Form paket harus memungkinkan user mengatur:

- `Nama paket`
- `SKU internal`
- `Status aktif`
- `Jual di marketplace`
- `Nama produk marketplace`
- `ID SKU marketplace`
- daftar komponen paket

Setiap komponen paket minimal menyimpan:

- produk komponen
- unit komponen: `SMALL` atau `LARGE`
- qty komponen per 1 paket

### Package Form Rules

- Paket harus punya minimal 1 komponen.
- Komponen paket hanya boleh berasal dari produk jenis `NORMAL`.
- Paket tidak boleh dipakai sebagai komponen paket lain.
- Paket tidak boleh mereferensikan dirinya sendiri.
- Produk komponen boleh muncul lebih dari satu kali hanya jika kombinasi unit berbeda benar-benar dibutuhkan; jika tidak, UI sebaiknya mendorong satu baris unik per `component_product_id + component_unit`.
- Qty komponen harus angka positif.
- Jika komponen memakai unit `LARGE`, produk komponen harus memang punya konfigurasi unit besar yang valid.
- Jika komponen memakai unit `LARGE`, harga paket memakai `harga_jual_unit_besar` komponen itu.
- Jika komponen memakai unit `SMALL`, harga paket memakai `harga_jual` komponen itu.

### POS UX

- Paket muncul di pencarian POS bersama produk biasa.
- Paket tampil sebagai item jual tunggal dengan label unit tetap, misalnya `paket`.
- Qty paket di POS harus bilangan bulat `>= 1`.
- Harga yang tampil di POS untuk paket adalah harga turunan paket saat katalog dibaca.
- Stok yang tampil di POS untuk paket adalah stok turunan paket saat katalog dibaca.
- Receipt tetap menampilkan nama paket dan total line paket seperti item biasa.
- Receipt tidak perlu memecah komponen paket.

## Data Model

### Prisma Changes

Tambahan schema harus additive-only:

1. Tambah enum baru:

```prisma
enum ProductKind {
  NORMAL
  PACKAGE
}
```

2. Tambah kolom baru pada `Product`:

- `product_kind ProductKind @default(NORMAL)`

3. Tambah tabel relasi resep paket, misalnya:

```prisma
model ProductPackageItem {
  id                  String                @id @default(cuid())
  package_product_id  String
  component_product_id String
  component_unit      InventoryMutationUnit
  component_qty       Float
  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt
}
```

Constraint yang dibutuhkan:

- foreign key ke `Product.id_produk` untuk paket
- foreign key ke `Product.id_produk` untuk komponen
- unique index minimal pada `package_product_id + component_product_id + component_unit`
- index pada `package_product_id`
- index pada `component_product_id`

4. Tambah kolom JSON pada `PosTransactionLine`:

- `stock_effect_snapshot Json?`

### Package Header in Product

Paket tetap disimpan sebagai row `Product` agar:

- punya `id_produk`
- punya `nama_produk`
- punya `sku`
- punya status aktif
- punya metadata marketplace
- ikut sync katalog offline seperti produk biasa

Tetapi paket tidak memakai stok/harga mandiri sebagai source of truth.

### Stored Fields for Package Rows

Untuk menjaga kompatibilitas shape `Product` yang sudah dipakai luas, paket tetap memiliki field standar seperti:

- `harga_jual`
- `stok_saat_ini`
- `allow_sell_in_small`
- `allow_sell_in_large`

Namun untuk paket:

- `harga_jual` diperlakukan sebagai cache turunan atau compatibility field, bukan sumber kebenaran utama
- `stok_saat_ini` diperlakukan sebagai cache turunan atau compatibility field, bukan sumber kebenaran utama
- `allow_sell_in_small = true`
- `allow_sell_in_large = false`
- `unit_small_name = "paket"` atau label tetap setara
- `unit_large_name = null`
- `marketplace_large_sku_id = null`

Implementasi baca katalog harus selalu menghitung ulang nilai efektif paket dari komponen sebelum dipakai di UI kritikal seperti tab `Paket`, POS, dan export marketplace.

## Derived Package Logic

### Package Price

Harga jual paket dihitung setiap kali data paket di-resolve:

`package_price = sum(component unit sell price * component_qty)`

Aturan harga komponen:

- `SMALL` memakai `Product.harga_jual`
- `LARGE` memakai `Product.harga_jual_unit_besar`

Jika ada komponen `LARGE` yang tidak punya harga unit besar valid, paket dianggap invalid dan tidak boleh disimpan atau dijual.

### Package Stock

Stok paket dihitung dari minimum kemampuan komponen memenuhi 1 paket:

`package_stock = min(floor(component available stock / component_qty))`

Aturan stok komponen:

- `SMALL` memakai `Product.stok_saat_ini`
- `LARGE` memakai `Product.stok_unit_besar_saat_ini`

Jika salah satu komponen punya stok negatif, hasil bagi untuk komponen itu dianggap `<= 0`, sehingga stok paket efektif menjadi `0`.

Jika paket tidak punya komponen valid, stok paket dianggap `0`.

### Marketplace Export Stock for Package

Jika katalog marketplace memakai row paket:

- matching tetap berdasarkan `marketplace_sku_id`
- stok yang diekspor adalah `package_stock` hasil turunan
- rumus persentase export tetap:
  - `ceil(package_stock * percentage / 100)`

## Offline Catalog Shape

`ProductRecord` dan payload sync produk perlu diperluas agar mengenali paket:

- `product_kind?: "NORMAL" | "PACKAGE"`
- `package_items?: PackageItemRecord[]`

Contoh shape item resep:

```ts
type PackageItemRecord = {
  component_product_id: string;
  component_unit: "SMALL" | "LARGE";
  component_qty: number;
};
```

Client harus menyediakan helper turunan murni yang:

- menerima katalog produk mentah
- membangun lookup produk normal
- menyelesaikan data paket menjadi `effective stock`, `effective price`, dan label unit jual

Helper ini harus dipakai konsisten oleh:

- tab `Paket`
- pencarian POS
- export marketplace

## POS Checkout and Stock Effects

### Transaction Display Contract

Saat checkout, line transaksi paket tetap disimpan sebagai line paket biasa agar:

- struk tetap terbaca user
- histori transaksi tetap merepresentasikan apa yang benar-benar dibeli kasir
- sync transaksi POS ke server tetap kompatibel dengan pola existing

Contoh:

- transaksi line menyimpan `id_produk` paket
- `nama_produk` line adalah nama paket
- `unit_price` line adalah harga paket saat transaksi
- `qty` line adalah jumlah bundle yang dibeli

### Inventory Mutation Contract

Walaupun line transaksi menyimpan paket, mutasi inventory tidak boleh ditulis ke stok paket. Mutasi inventory harus diturunkan menjadi mutasi ke komponen.

Contoh:

- Paket A = Produk A `1 SMALL` + Produk B `2 SMALL` + Produk C `1 LARGE`
- Kasir membeli `3` paket
- Sistem menulis mutasi:
  - Produk A `-3 SMALL`
  - Produk B `-6 SMALL`
  - Produk C `-3 LARGE`

### Stock Effect Snapshot

Untuk setiap `PosTransactionLine`, simpan `stock_effect_snapshot` yang merekam dampak stok aktual line itu pada saat transaksi disimpan.

Shape konseptual:

```ts
type StockEffectSnapshot = {
  source_kind: "NORMAL" | "PACKAGE";
  effects: Array<{
    id_produk: string;
    nama_produk_snapshot: string;
    unit_mutasi: "SMALL" | "LARGE";
    qty_delta: number;
  }>;
};
```

Aturan:

- untuk produk `NORMAL`, `effects` berisi 1 entry direct
- untuk `PACKAGE`, `effects` berisi efek final ke semua komponen untuk qty line tersebut

Snapshot ini wajib disimpan agar:

- delete transaksi lama tetap membalik stok yang benar meski resep paket sudah berubah
- restore transaksi lama tetap menerapkan kembali stok yang benar
- edit transaksi bisa membandingkan efek lama vs efek baru

### Logical Clock for Package Mutations

Mutasi komponen hasil checkout paket harus tetap deterministik untuk offline replay:

- urutkan berdasarkan urutan line cart
- di dalam line paket, urutkan berdasarkan urutan komponen yang tersimpan
- `logical_clock` bertambah satu per mutasi final yang ditulis

## Transaction History Reconciliation

### Legacy Safety

Data transaksi lama di production tidak punya `stock_effect_snapshot`.

Aturan kompatibilitas:

- jika `stock_effect_snapshot` kosong pada line lama, sistem fallback ke efek direct dari line itu sendiri
- ini aman karena transaksi lama sebelum fitur paket hanya berisi produk biasa

### Delete Transaction

Saat transaksi didelete:

- sistem membuat mutasi koreksi yang membalik efek stok dari seluruh line aktif transaksi
- mutasi koreksi ditulis sebagai `STOCK_ADJUSTMENT`
- arah delta harus kebalikan dari snapshot lama

Contoh:

- line lama punya efek `Produk B SMALL -6`
- delete harus menulis `Produk B SMALL +6`

### Restore Transaction

Saat transaksi direstore:

- sistem membuat mutasi koreksi yang menerapkan kembali efek stok dari snapshot line transaksi
- mutasi koreksi ditulis sebagai `STOCK_ADJUSTMENT`

Contoh:

- snapshot line punya efek `Produk B SMALL -6`
- restore harus menulis `Produk B SMALL -6`

### Edit Transaction

Saat transaksi diedit:

1. bentuk efek stok lama dari line transaksi existing
2. bentuk efek stok baru dari draft line hasil edit
3. hitung delta per `id_produk + unit_mutasi`
4. tulis hanya selisihnya sebagai `STOCK_ADJUSTMENT`

Aturan:

- jika qty paket bertambah, delta komponen negatif
- jika qty paket berkurang, delta komponen positif
- jika line paket dihapus, semua efek lama dibalik
- jika line paket diganti ke produk lain, efek lama dibalik lalu efek baru diterapkan

### Recipe Change After Original Sale

Jika resep paket berubah setelah transaksi awal:

- delete dan restore transaksi lama tetap memakai `stock_effect_snapshot` lama
- edit transaksi yang mengubah line ke state baru memakai definisi katalog terkini untuk state baru itu

Ini menjaga dua hal sekaligus:

- audit historis tetap benar untuk aksi pembalikan transaksi lama
- hasil edit baru mengikuti konfigurasi paket terkini

## API and Validation Rules

### Product Upsert Rules

Server harus memvalidasi:

- `NORMAL` product tidak boleh membawa `package_items`
- `PACKAGE` product wajib membawa minimal 1 `package_item`
- setiap `package_item.component_product_id` harus mereferensikan produk `NORMAL`
- `PACKAGE` tidak boleh menjadi komponen paket lain
- tidak boleh ada self-reference
- `PACKAGE` tidak boleh memiliki `allow_sell_in_large = true`
- `PACKAGE` tidak boleh memiliki `marketplace_large_sku_id`
- `PACKAGE` tidak boleh di-stock-in secara manual

### Sync Rules

Product sync existing tetap dipakai, tetapi payload produk diperluas untuk membawa:

- `product_kind`
- `package_items`

Server upsert paket harus replace resep paket secara atomik, bukan merge parsial, agar state offline dan server tetap konsisten.

## Inventory and POS Isolation Requirements

Perubahan ini tidak boleh merusak flow existing:

- tab `Produk` tetap berperilaku sama untuk produk normal
- tab `Stock In` tetap berperilaku sama untuk produk normal
- produk normal existing tidak perlu dimigrasikan manual selain default `product_kind = NORMAL`
- replay inventory server tetap hanya memproses mutasi ke produk riil
- POS receipt format tetap kompatibel
- sync transaction batch tetap kompatibel
- legacy transaksi tetap bisa dibaca tanpa backfill destruktif

## Migration and Production Safety

### Required Migration Style

Perubahan database harus memakai Prisma migration baru, additive-only.

Yang boleh dilakukan:

- tambah enum
- tambah kolom dengan default aman
- tambah tabel baru
- tambah kolom JSON nullable
- tambah index dan foreign key

Yang tidak boleh dilakukan:

- drop kolom lama production
- rename destruktif pada tabel inti
- rewrite stok existing
- `prisma db push` ke production
- backfill yang mengubah histori transaksi lama

### Deployment Safety

Karena project sudah mengadopsi baseline migrate untuk production existing:

- perubahan schema baru harus masuk sebagai migration Prisma baru
- deploy production tetap melalui `pnpm exec prisma migrate deploy`
- jangan menjalankan `prisma migrate reset`
- jangan menjalankan `db push` di production

## Testing Scope

### Inventory Tests

- tab `Paket` muncul, tab `Produk` tetap tidak menampilkan paket
- tab `Stock In` tidak menerima paket
- form paket menyimpan metadata marketplace sku-only
- validasi melarang paket tanpa komponen
- validasi melarang nested package dan self-reference
- stok paket turunan benar untuk campuran `SMALL` dan `LARGE`
- harga paket selalu mengikuti harga komponen terbaru

### POS Tests

- pencarian POS menampilkan paket aktif
- line paket di cart memakai harga paket turunan
- checkout paket menulis line transaksi sebagai paket
- checkout paket membuat stock-out ke komponen, bukan ke paket
- qty paket di POS hanya menerima integer

### Transaction History Tests

- delete transaksi paket mengembalikan stok komponen
- restore transaksi paket mengurangi lagi stok komponen
- edit transaksi paket menghitung delta stok komponen dengan benar
- edit note/payment only tidak menghasilkan delta stok
- transaksi lama tanpa `stock_effect_snapshot` tetap aman didelete/direstore sebagai produk direct
- perubahan resep paket setelah transaksi awal tidak merusak delete/restore transaksi lama

### Sync and Server Tests

- product sync membawa `product_kind` dan `package_items`
- inventory replay server tetap hanya memutasi produk komponen
- transaction sync tetap bisa memuat line paket dan `stock_effect_snapshot`
- export marketplace memakai stok paket turunan

### Regression Runs

- re-run suite inventory existing
- re-run suite POS existing
- re-run suite sync existing
- fokus khusus pada flow offline catalog, checkout, transaction edit/delete/restore, dan marketplace export

## Out Of Scope

- paket bertingkat atau nested bundles
- package stock-in manual
- package unit besar
- special price khusus paket
- marketplace large-unit SKU untuk paket
- perubahan format receipt untuk merinci komponen paket
- migrasi destruktif terhadap histori transaksi lama
