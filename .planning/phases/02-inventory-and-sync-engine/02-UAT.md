---
status: partial
phase: 02-inventory-and-sync-engine
source:
  - 02-01-SUMMARY.md
  - 02-02-SUMMARY.md
started: 2026-05-17T12:38:01Z
updated: 2026-05-17T12:52:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Setelah server dimatikan lalu dijalankan dari nol, aplikasi bisa boot tanpa error, migrasi/seed yang diperlukan selesai, dan endpoint health/aplikasi utama merespons normal.
result: pass

### 2. Offline Stock In/Adjustment Persistence
expected: Saat offline, owner/kasir bisa simpan Stock In dan Stock Adjustment; event mutasi tersimpan lokal (append-only) dan antrean sync bertambah status pending.
result: blocked
blocked_by: prior-phase
reason: "tidak bisa di test, belum ada menu inventory sampai phase 2.1 karena baru diplan"

### 3. Negative Stock Warning Bypass
expected: Saat qty melebihi stok atau stok <= 0, muncul warning "Stok barang ini kurang, stock akhir akan 0 atau mines!" dan kasir bisa lanjut dengan Enter tanpa approval.
result: blocked
blocked_by: prior-phase
reason: "belum bisa di test karena PoS baru ada di fase 3"

### 4. POS Stock-Out Queue Capture
expected: Aksi stock-out dari alur POS membuat event SALES_OUT dengan metadata lengkap dan masuk antrean sync tanpa memblokir alur kasir.
result: blocked
blocked_by: prior-phase
reason: "tidak bisa ditest pos baru ada di fase 3"

### 5. Reconnect Auto Sync + Retry Exhaustion
expected: Saat koneksi kembali, background sync memproses antrean otomatis; retry backoff berjalan sampai 5 kali, lalu status unstable/retry exhausted muncul dan manual retry tersedia.
result: blocked
blocked_by: prior-phase
reason: "sama tidak bisa di test ada di fase 3"

### 6. Deterministic Replay Ordering
expected: Di server, delta diterapkan urut FIFO penerimaan server, tie-break client timestamp terkecil, dan hasil stok tetap konsisten untuk skenario 1-3 device termasuk stok minus.
result: blocked
blocked_by: other
reason: "test 6 benar-benar tidak bisa di test, saya hanya akan testing melalui interface dan tidak akan testing lewat API"

## Summary

total: 6
passed: 1
issues: 0
pending: 0
skipped: 0

## Gaps

none
