---
status: partial
phase: 01-foundation-auth-and-offline-core
source: [implementation-derived: src/app/page.tsx, src/app/(app)/page.tsx, src/app/offline/page.tsx, src/features/format/currency.ts, src/features/format/datetime.ts]
started: 2026-05-17T13:32:55.7534187Z
updated: 2026-05-17T04:04:02.5178018Z
---

## Current Test

[testing complete]

## Tests

### 1. Login Online dengan kredensial valid
expected: Saat perangkat online, memasukkan username dan password valid lalu klik "Masuk" harus membuka dashboard /app dan menampilkan nama user pada halaman.
result: pass

### 2. Login ditolak untuk password salah
expected: Saat online, jika password salah maka login ditolak dan pesan error ditampilkan (tidak masuk ke dashboard).
result: pass

### 3. Login offline untuk user yang pernah login
expected: Setelah user pernah berhasil login online di device ini, saat offline user bisa login kembali memakai kredensial lokal terenkripsi.
result: issue
reported: "dalam kondisi login, masuk mode offline menampilkan tampilan Mode Offline Aktif seharusnya fungsionalitas website tetap bisa digunakan. Dalam posisi logout (di halaman login) juga sama, konsisi offline menampilkan Mode Offline Aktif bukan halaman login page"
severity: major

### 4. Session valid langsung masuk
expected: Jika sesi masih valid, membuka root page (/) harus langsung redirect ke dashboard tanpa perlu login ulang.
result: issue
reported: "membuka root page saat kondisi login masih mengarahkan ke halaman login"
severity: major

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
  reason: "User reported: dalam kondisi login/offline selalu tampil halaman Mode Offline Aktif, bukan flow aplikasi/login yang bisa dipakai"
  severity: major
  test: 3
  root_cause: "Service worker masih mem-fallback semua navigasi saat offline ke /offline, sehingga halaman login maupun app shell tidak dirender saat koneksi putus."
  artifacts:
    - path: "public/sw.js"
      issue: "navigasi offline tidak dibedakan per route/login state"
    - path: "src/app/offline/page.tsx"
      issue: "offline page menjadi fallback tunggal untuk semua route"
  missing:
    - "Ubah strategi offline navigation: route inti (/, /app) tetap render shell/login dari cache, bukan dipaksa ke /offline"
    - "Jadikan /offline hanya fallback terakhir saat route inti benar-benar tidak tersedia"
  debug_session: ""

- truth: "Jika sesi masih valid, membuka root page (/) langsung redirect ke dashboard tanpa login ulang"
  status: failed
  reason: "User reported: membuka root page saat kondisi login masih mengarahkan ke halaman login"
  severity: major
  test: 4
  root_cause: "Validasi session root saat ini hanya bergantung cookie server-side; saat kondisi tertentu (offline/refresh) state sesi lokal tidak dipakai untuk mempertahankan auto-redirect."
  artifacts:
    - path: "src/app/page.tsx"
      issue: "guard redirect hanya cek cookie server session"
    - path: "src/lib/session/offline-session.ts"
      issue: "session lokal belum diintegrasikan sebagai fallback redirect root"
  missing:
    - "Tambahkan bridging session check client-side pada root untuk fallback saat cookie/session server tidak tersedia"
    - "Sinkronkan logout flow agar session cookie dan local session konsisten"
  debug_session: ""
