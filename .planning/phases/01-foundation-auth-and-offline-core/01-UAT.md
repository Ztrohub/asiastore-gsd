---
status: partial
phase: 01-foundation-auth-and-offline-core
source: [implementation-derived: src/app/page.tsx, src/app/(app)/page.tsx, src/app/offline/page.tsx, src/features/format/currency.ts, src/features/format/datetime.ts]
started: 2026-05-17T13:32:55.7534187Z
updated: 2026-05-17T03:45:48.7748922Z
---

## Current Test

[testing complete]

## Tests

### 1. Login Online dengan kredensial valid
expected: Saat perangkat online, memasukkan username dan password valid lalu klik "Masuk" harus membuka dashboard /app dan menampilkan nama user pada halaman.
result: issue
reported: "halaman login terbuka, setelah klik masuk dengan user valid muncul the site can't be reached dengan console The FetchEvent for \"http://localhost:3000/app\" resulted in a network error response: a redirected response was used for a request whose redirect mode is not \"follow\"."
severity: blocker

### 2. Login ditolak untuk password salah
expected: Saat online, jika password salah maka login ditolak dan pesan error ditampilkan (tidak masuk ke dashboard).
result: pass

### 3. Login offline untuk user yang pernah login
expected: Setelah user pernah berhasil login online di device ini, saat offline user bisa login kembali memakai kredensial lokal terenkripsi.
result: blocked
blocked_by: prior-phase
reason: "tidak bisa di test karena tidak bisa logout untuk coba re-login saat offline (dashboard 404)"

### 4. Session valid langsung masuk
expected: Jika sesi masih valid, membuka root page (/) harus langsung redirect ke dashboard tanpa perlu login ulang.
result: blocked
blocked_by: prior-phase
reason: "tidak bisa di test, app shell tidak bisa terbuka"

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
passed: 4
issues: 1
pending: 0
skipped: 1
blocked: 2

## Gaps

- truth: "Saat perangkat online, memasukkan username dan password valid lalu klik Masuk membuka dashboard /app dan menampilkan nama user"
  status: failed
  reason: "User reported: halaman login terbuka, setelah klik masuk dengan user valid muncul the site can't be reached dengan console The FetchEvent for http://localhost:3000/app resulted in a network error response: a redirected response was used for a request whose redirect mode is not follow."
  severity: blocker
  test: 1
  root_cause: "Service worker fetch handler mengembalikan redirected response untuk request yang redirect mode-nya bukan 'follow', sehingga browser menolak response dan navigasi ke /app gagal."
  artifacts:
    - path: "public/sw.js"
      issue: "strategi fetch belum aman untuk response redirect pada navigation request"
    - path: "src/features/pwa/service-worker-register.tsx"
      issue: "SW aktif di jalur login sehingga mempengaruhi flow auth redirect"
  missing:
    - "Perbaiki fetch strategy di service worker agar tidak mengembalikan redirected response yang invalid"
    - "Tambahkan guard untuk navigation requests (fallback ke network/default browser handling)"
  debug_session: ""
