# Phase 2: Inventory and Sync Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 2-Inventory and Sync Engine
**Areas discussed:** Event model mutasi stok, Resolusi konflik delta antar-device, Warning stok minus POS, Sync cycle dan recovery status

---

## Event model mutasi stok

| Option | Description | Selected |
|--------|-------------|----------|
| Granular per item | Satu event untuk satu SKU per aksi dan metadata lengkap per mutasi | ? |
| Batched per transaksi | Satu dokumen untuk banyak item | |
| Hybrid | Header transaksi + line-level sync | |

**User's choice:** Granular per item dengan metadata wajib `id_queue`, `id_transaksi`, `id_produk`, `id_user`, `jenis_mutasi`, `delta_qty`, `logical_clock`, `client_timestamp`.
**Notes:** Transaksi penjualan POS disimpan/sync di tabel terpisah dari event delta stok.

---

## Resolusi konflik delta antar-device

| Option | Description | Selected |
|--------|-------------|----------|
| Logical clock dominant | Urutan final berdasarkan logical clock | |
| Server receive order | Urutan berdasarkan waktu diterima server | |
| Hybrid FIFO server + tie-break timestamp | FIFO server, jika bersamaan pilih `client_timestamp` terkecil | ? |

**User's choice:** Hybrid ordering.
**Notes:** Server menghitung delta secara beruntun untuk stok akhir.

---

## Warning stok minus POS

| Option | Description | Selected |
|--------|-------------|----------|
| Soft warning + lanjut | Warning muncul tapi kasir tetap bisa lanjut transaksi | ? |
| Hard block | Blok transaksi jika stok minus | |
| Role-based override | Butuh approval role tertentu | |

**User's choice:** Soft warning + bypass penuh.
**Notes:** Trigger warning saat qty > stok atau stok saat ini `<= 0`. Copy: `Stok barang ini kurang, stock akhir akan 0 atau mines!`. Tekan `Enter` pada popup untuk lanjut.

---

## Sync cycle dan recovery status

| Option | Description | Selected |
|--------|-------------|----------|
| `pending -> sent -> acked/failed` | Queue status eksplisit + retry policy | ? |
| `pending -> processing -> done/error` | Status umum | |
| Minimal status | `pending/done` saja | |

**User's choice:** Decoupled background sync dengan status `pending/sent/acked/failed`.
**Notes:** Save transaksi mengembalikan user ke flow kasir; background job/web worker sync periodik push/pull. Retry exponential backoff 5x, lalu status koneksi tidak stabil dan tombol Retry muncul. `failed` untuk error kritis tidak auto-retry; data tetap lokal untuk traceback. Ditambahkan: background sync juga wajib untuk menu Stock Adjustment dan Stock In.

---

## the agent's Discretion

- Penentuan detail teknis scheduler, interval, dan payload transport dilimpahkan ke tahap planning/research.

## Deferred Ideas

- Otorisasi override warning stok minus berbasis approval owner untuk fase mendatang.
