---
status: partial
phase: 01-foundation-auth-and-offline-core
source: [implementation-derived: src/app/page.tsx, src/app/(app)/page.tsx, src/app/offline/page.tsx, src/features/format/currency.ts, src/features/format/datetime.ts]
started: 2026-05-17T13:32:55.7534187Z
updated: 2026-05-17T04:45:20.9688397Z
---

## Current Test

[testing complete]

## Tests

### 1. Login Online dengan kredensial valid
expected: Saat perangkat online, memasukkan username dan password valid lalu klik "Masuk" harus membuka dashboard /app, menampilkan nama user, dan role sesuai akun login.
result: issue
reported: "nama user dan role masih belum valid"
severity: major

### 2. Login ditolak untuk password salah
expected: Saat online, jika password salah maka login ditolak dan pesan error ditampilkan (tidak masuk ke dashboard).
result: pass

### 3. Login offline untuk user yang pernah login
expected: Setelah user pernah berhasil login online di device ini, saat offline user bisa tetap berada di route/menu yang sama tanpa redirect paksa ke /offline, indikator status berubah ke offline, dan logout/login ulang offline berjalan via sesi/kredensial lokal.
result: issue
reported: "indikator online/offline sudah benar, user tetap stay tanpa redirect ke /offline, tapi ketika menekan tombol keluar dialihkan ke /offline saya harus mengarahkan ke route manual untuk kembali ke halaman login. Logout dan mencoba login dengan kondisi offline menampilkan error sesi lokal tidak valid. Silahkan login online padahal kondisi sesi masih valid"
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

- truth: "Identitas user (nama dan role) yang tampil di dashboard harus sesuai akun yang login"
  status: failed
  reason: "User reported: nama user dan role masih belum valid"
  severity: major
  test: 1
  root_cause: "State sesi yang dipakai render dashboard masih dapat tercampur dengan state sesi sebelumnya (cookie/cache/local-session), sehingga identitas akun aktif tidak konsisten."
  artifacts:
    - path: "src/app/app/page.tsx"
      issue: "render identitas hanya dari cookie session tanpa verifikasi silang"
    - path: "src/components/auth/login-form.tsx"
      issue: "transisi akun belum memastikan sinkronisasi total state lokal"
    - path: "public/sw.js"
      issue: "cache navigasi berpotensi menyajikan state route lama"
  missing:
    - "Tambahkan validasi identitas akun aktif setelah login (cross-check ke /api/auth/session)"
    - "Pastikan pergantian akun membersihkan state user sebelumnya secara atomik"
  debug_session: ""

- truth: "Saat offline, logout dan login ulang harus kembali ke login route yang benar dan bisa login offline bila sesi lokal masih valid"
  status: failed
  reason: "User reported: logout saat offline diarahkan ke /offline dan login offline menganggap sesi lokal tidak valid padahal masih valid"
  severity: major
  test: 3
  root_cause: "Flow logout offline dan verifikasi sesi lokal belum selaras; redirect/fallback SW masih bisa mendorong ke /offline pada timing tertentu dan cek sesi lokal terlalu ketat pada path login ulang."
  artifacts:
    - path: "src/components/auth/logout-button.tsx"
      issue: "logout offline belum menjamin kembali ke login shell yang stabil"
    - path: "src/components/auth/login-form.tsx"
      issue: "login offline mensyaratkan sesi lokal aktif yang mungkin sudah terhapus pada logout"
    - path: "public/sw.js"
      issue: "fallback navigasi masih bisa memilih /offline pada kondisi tertentu"
  missing:
    - "Revisi kontrak logout offline: keluar akun tapi tetap izinkan login ulang offline untuk user cached"
    - "Pisahkan validasi login offline dari ketergantungan sesi aktif sebelumnya"
    - "Pastikan route / tetap jadi landing logout offline, bukan /offline"
  debug_session: ""
