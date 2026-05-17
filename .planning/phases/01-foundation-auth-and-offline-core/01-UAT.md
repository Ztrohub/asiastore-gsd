---
status: partial
phase: 01-foundation-auth-and-offline-core
source: [implementation-derived: src/app/page.tsx, src/app/(app)/page.tsx, src/app/offline/page.tsx, src/features/format/currency.ts, src/features/format/datetime.ts]
started: 2026-05-17T13:32:55.7534187Z
updated: 2026-05-17T04:24:17.1806716Z
---

## Current Test

[testing complete]

## Tests

### 1. Login Online dengan kredensial valid
expected: Saat perangkat online, memasukkan username dan password valid lalu klik "Masuk" harus membuka dashboard /app dan menampilkan nama user pada halaman.
result: issue
reported: "tambahan issue, login sebagai cashier tampil sebagai owner"
severity: major

### 2. Login ditolak untuk password salah
expected: Saat online, jika password salah maka login ditolak dan pesan error ditampilkan (tidak masuk ke dashboard).
result: pass

### 3. Login offline untuk user yang pernah login
expected: Setelah user pernah berhasil login online di device ini, saat offline user bisa login kembali memakai kredensial lokal terenkripsi.
result: issue
reported: "kondisi logged in online, mematikan mode offline dan merefresh page -> tampil page /offline (mode offline aktif) saya harus mengarahkan url ke /app atau / untuk dapat kembali ke halaman app shell. Mengarahkan manual dapat menampilkan page dalam kondisi offline. Expected: jika tiba-tiba beralih ke mode offline seharusnya maka tetap di menu yang sama tanpa perlu ubah url manual. Dalam kondisi offline this app shell, status user masih online. Seharusnya ada indikasi sedang di mode offline. Keluar dalam mode offline dan mencoba login ulang muncul error failed to fetch. Dalam kasus tertentu (beralih dari online ke offline) ada case di mana web berkedip berkali-kali tanpa henti."
severity: major

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
passed: 5
issues: 2
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Setelah user pernah berhasil login online di device ini, saat offline user bisa login kembali memakai kredensial lokal terenkripsi"
  status: failed
  reason: "User reported: transisi online->offline mengarah ke /offline, perlu ubah URL manual, status online tidak berubah, logout/login offline failed to fetch, dan kadang flicker terus-menerus"
  severity: major
  test: 3
  root_cause: "Strategi SW + state sinkronisasi online/offline di UI belum stabil untuk transisi real-time (refresh/navigation/logout)."
  artifacts:
    - path: "public/sw.js"
      issue: "routing fallback offline belum menjaga route aktif saat koneksi drop"
    - path: "src/app/app/page.tsx"
      issue: "status sesi masih hardcoded Online"
    - path: "src/components/auth/login-form.tsx"
      issue: "path login offline tidak graceful saat request/fetch gagal"
  missing:
    - "Pertahankan route aktif saat transisi ke offline (tanpa redirect paksa ke /offline)"
    - "Tambahkan indikator status offline/online yang aktual di app shell"
    - "Tangani logout/login saat offline tanpa memicu failed-to-fetch yang memutus flow"
    - "Hilangkan loop flicker saat network berubah"
  debug_session: ""

- truth: "Role yang ditampilkan di dashboard sesuai akun login"
  status: failed
  reason: "User reported: login sebagai cashier tampil sebagai owner"
  severity: major
  test: 1
  root_cause: "Kemungkinan mismatch data role pada session/cookie/local-session yang dipakai render dashboard."
  artifacts:
    - path: "src/app/api/auth/login/route.ts"
      issue: "payload role dari DB perlu diverifikasi terhadap session yang diset"
    - path: "src/lib/session/offline-session.ts"
      issue: "role cached di local session dapat stale/tertimpa"
    - path: "src/app/app/page.tsx"
      issue: "dashboard render role dari session tanpa cross-check"
  missing:
    - "Validasi konsistensi role dari DB -> token -> local session -> UI"
    - "Pastikan pergantian akun mengganti local session atomically"
  debug_session: ""
