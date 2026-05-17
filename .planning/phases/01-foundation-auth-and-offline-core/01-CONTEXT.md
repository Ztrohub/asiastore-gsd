# Phase 1: Foundation, Auth, and Offline Core - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Membangun fondasi aplikasi POS offline-first untuk fase lanjutan: autentikasi dasar dengan kesinambungan sesi offline pada device yang sama, baseline local database + sync queue, app shell responsif desktop/tablet/mobile, serta standardisasi lokalisasi Indonesia (bahasa, IDR, timezone).

</domain>

<decisions>
## Implementation Decisions

### Strategi autentikasi offline
- **D-01:** User yang pernah berhasil login boleh login saat offline menggunakan kredensial lokal terenkripsi.
- **D-02:** User baru tetap membutuhkan koneksi online untuk login pertama.
- **D-03:** Perubahan password/role berlaku saat device terkoneksi dan sinkronisasi terjadi.
- **D-04:** Jika user yang sedang login terdeteksi berubah (password/role) setelah sync, sesi aktif wajib diakhiri dan user diminta login ulang.

### Kebijakan session continuity
- **D-05:** Idle timeout ditetapkan 6 jam.
- **D-06:** Session wajib re-login pada hari Senin; re-login tetap harus bisa dilakukan saat offline untuk user yang pernah login.
- **D-07:** Saat app dibuka ulang dan sesi masih valid, user langsung masuk tanpa PIN tambahan.

### Local database dan sync baseline
- **D-08:** Penyimpanan lokal menggunakan `IndexedDB + Dexie`.
- **D-09:** Wajib ada tabel `sync_queue` append-only dengan status `pending/sent/acked/failed`.
- **D-10:** Retry sinkronisasi menggunakan strategi `immediate + exponential backoff` ketika koneksi kembali.
- **D-11:** Arah kebijakan konflik mengikuti model delta dengan dukungan stok minus.

### App shell responsif dan baseline keyboard
- **D-12:** Pendekatan layout `desktop-first`, lalu adaptif ke tablet/mobile.
- **D-13:** Breakpoint baseline: `>=1024` desktop, `768-1023` tablet, `<768` mobile.
- **D-14:** Shortcut keyboard domain POS: mengetik huruf langsung memicu pencarian produk, `ArrowUp/ArrowDown` pindah fokus item list aktif, `ArrowLeft/ArrowRight` pindah fokus antar-list, `Enter` proses item.
- **D-15:** Shortcut `void`, `cash payment`, dan `transfer payment` dicatat sebagai preferensi interaction POS; implementasi checkout detail tetap mengikuti scope fase POS checkout.

### Standar lokalisasi Indonesia
- **D-16:** Format IDR tanpa desimal.
- **D-17:** Semua formatter default menggunakan locale `id-ID`.
- **D-18:** Timezone default operasional `Asia/Jakarta` dengan format datetime `dd-mm-yyyy hh:mm:ss`.

### the agent's Discretion
- Penamaan final keymap shortcut, detail struktur tabel tambahan selain `sync_queue`, dan detail mekanisme enkripsi kredensial lokal ditetapkan saat planning/research selama tidak melanggar keputusan yang sudah dikunci.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product scope and phase boundaries
- `.planning/ROADMAP.md` - Goal, scope fase 1, dan success criteria yang harus dipenuhi.
- `.planning/REQUIREMENTS.md` - Mapping requirement AUTH/SYNC/UI yang menjadi target fase 1.
- `.planning/PROJECT.md` - Constraint operasional produk (offline-first, printer path, locale, performance).

### External specs
- No external specs - requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Belum ada aset codebase yang bisa dipakai ulang; repository saat ini masih berisi artefak perencanaan.

### Established Patterns
- Belum ada pola implementasi kode yang established; keputusan di dokumen ini menjadi baseline pola awal fase implementasi.

### Integration Points
- Entry point implementasi berikutnya dimulai dari struktur aplikasi baru yang akan dibuat pada fase planning/execution phase 1.

</code_context>

<specifics>
## Specific Ideas

- Keyboard behavior di POS harus natural untuk kasir: ketik langsung cari produk, navigasi list pakai arrow keys, dan `Enter` untuk proses item.
- Konsistensi locale operasional Indonesia wajib sejak fondasi (IDR tanpa desimal, Bahasa Indonesia, timezone Asia/Jakarta).

</specifics>

<deferred>
## Deferred Ideas

- Detail implementasi full shortcut action checkout (`void`, `cash payment`, `transfer payment`) yang menyentuh alur transaksi lengkap diperdalam pada fase POS Checkout agar tidak melebar dari boundary fase 1.

</deferred>

---

*Phase: 1-Foundation, Auth, and Offline Core*
*Context gathered: 2026-05-17*
