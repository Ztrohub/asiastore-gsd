---
status: complete
phase: 01-foundation-auth-and-offline-core
source: [implementation-derived: src/app/page.tsx, src/app/(app)/page.tsx, src/app/offline/page.tsx, src/features/format/currency.ts, src/features/format/datetime.ts]
started: 2026-05-17T13:32:55.7534187Z
updated: 2026-05-17T05:56:20.7415855Z
---

## Current Test

[testing complete]

## Tests

### 1. Login Online dengan kredensial valid
expected: Saat perangkat online, memasukkan username dan password valid lalu klik "Masuk" harus membuka dashboard /app, menampilkan nama user, dan role sesuai akun login (termasuk setelah logout lalu login akun berbeda).
result: pass

### 2. Login ditolak untuk password salah
expected: Saat online, jika password salah maka login ditolak dan pesan error ditampilkan (tidak masuk ke dashboard).
result: pass

### 3. Login offline untuk user yang pernah login
expected: Saat offline, user tetap di route aktif (tanpa redirect paksa ke /offline), indikator status offline akurat, logout/logout intent konsisten, re-login offline sesuai kontrak v1, dan error password salah tampil.
result: pass

### 4. Session valid langsung masuk
expected: Jika sesi masih valid, membuka root page (/) harus langsung redirect ke dashboard tanpa perlu login ulang.
result: pass

### 5. Re-login wajib hari Senin
expected: Pada hari Senin, sistem meminta login ulang sesuai kebijakan sesi, termasuk saat kondisi offline.
result: skipped
reason: "tidak bisa di test, harus ubah tanggal datetime di system os, untuk test ini silahkan agent coba sendiri atau skip saja"

### 6. Support light/dark theme
expected: UI bisa berganti light/dark theme dan perubahan tema terlihat konsisten pada login page dan app shell.
result: pass

### 7. Format IDR tanpa desimal
expected: Nilai uang tampil dalam locale id-ID dengan format IDR tanpa desimal (contoh: Rp2.500.000).
result: pass

### 8. Format waktu Asia/Jakarta
expected: Datetime tampil mengikuti timezone Asia/Jakarta dengan format dd-mm-yyyy hh:mm:ss.
result: pass

## Summary

total: 8
passed: 7
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

[]
