---
status: partial
phase: 01-foundation-auth-and-offline-core
source: [implementation-derived: src/app/page.tsx, src/app/(app)/page.tsx, src/app/offline/page.tsx, src/features/format/currency.ts, src/features/format/datetime.ts]
started: 2026-05-17T13:32:55.7534187Z
updated: 2026-05-17T03:33:13.3148245Z
---

## Current Test

[testing complete]

## Tests

### 1. Login Online dengan kredensial valid
expected: Saat perangkat online, memasukkan username dan password valid lalu klik "Masuk" harus membuka dashboard /app dan menampilkan nama user pada halaman.
result: issue
reported: "login dengan user valid masuk ke halaman /app tetapi 404 this page could not be found"
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
result: issue
reported: "membuka root page setelah login mengarahkan saya kembali ke halaman login"
severity: major

### 5. Re-login wajib hari Senin
expected: Pada hari Senin, sistem meminta login ulang sesuai kebijakan sesi, termasuk saat kondisi offline.
result: skipped
reason: "tidak bisa di test, harus ubah tanggal datetime di system os, untuk test ini silahkan agent coba sendiri atau skip saja"

### 6. Support light/dark theme
expected: UI bisa berganti light/dark theme dan perubahan tema terlihat konsisten pada login page dan app shell.
result: issue
reported: "kondisi saat ini di dark-theme, tidak ada kontrol theme di halaman login untuk ubah tema ke light theme (halaman app shell 404)"
severity: major

### 7. Format IDR tanpa desimal
expected: Nilai uang tampil dalam locale id-ID dengan format IDR tanpa desimal (contoh: Rp2.500.000).
result: blocked
blocked_by: prior-phase
reason: "tidak bisa di test (app shell / dashboard 404)"

### 8. Format waktu Asia/Jakarta
expected: Datetime tampil mengikuti timezone Asia/Jakarta dengan format dd-mm-yyyy hh:mm:ss.
result: blocked
blocked_by: prior-phase
reason: "tidak bisa di test (app shell / dashboard 404)"

## Summary

total: 8
passed: 1
issues: 3
pending: 0
skipped: 1
blocked: 3

## Gaps

- truth: "Saat perangkat online, memasukkan username dan password valid lalu klik Masuk membuka dashboard /app dan menampilkan nama user"
  status: failed
  reason: "User reported: login dengan user valid masuk ke halaman /app tetapi 404 this page could not be found"
  severity: blocker
  test: 1
  root_cause: "Aplikasi mengarahkan ke path /app, tetapi halaman dashboard saat ini ditempatkan di route group src/app/(app)/page.tsx yang resolve ke '/' (bukan '/app')."
  artifacts:
    - path: "src/app/page.tsx"
      issue: "router.push('/app') diarahkan ke path yang tidak ada"
    - path: "src/app/(app)/page.tsx"
      issue: "route group tidak menambahkan segmen URL '/app'"
  missing:
    - "Pindahkan dashboard ke src/app/app/page.tsx atau ubah semua redirect/push dari '/app' ke route aktual"
  debug_session: ""

- truth: "Jika sesi masih valid, membuka root page (/) langsung redirect ke dashboard tanpa login ulang"
  status: failed
  reason: "User reported: membuka root page setelah login mengarahkan saya kembali ke halaman login"
  severity: major
  test: 4
  root_cause: "Halaman login di src/app/page.tsx adalah client component tanpa validasi session cookie server-side, sehingga root selalu render form login."
  artifacts:
    - path: "src/app/page.tsx"
      issue: "tidak ada pemeriksaan cookie SESSION_COOKIE_NAME + redirect saat sesi valid"
  missing:
    - "Tambahkan guard server-side pada root (mis. server page yang redirect ke /app saat session valid)"
  debug_session: ""

- truth: "UI bisa berganti light/dark theme dan perubahan konsisten pada login page dan app shell"
  status: failed
  reason: "User reported: kondisi saat ini di dark-theme, tidak ada kontrol theme di halaman login untuk ubah tema ke light theme (halaman app shell 404)"
  severity: major
  test: 6
  root_cause: "Kontrol ThemeToggle hanya ada di app shell layout; login page belum menyediakan kontrol pergantian tema."
  artifacts:
    - path: "src/app/(app)/layout.tsx"
      issue: "ThemeToggle ada hanya di shell"
    - path: "src/app/page.tsx"
      issue: "login page tidak memuat ThemeToggle"
  missing:
    - "Tambahkan ThemeToggle pada login page"
    - "Pastikan route shell bisa diakses (fix gap test 1) agar verifikasi konsistensi tema end-to-end bisa dilakukan"
  debug_session: ""
