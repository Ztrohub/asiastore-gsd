# Phase 2: Inventory and Sync Engine - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Membangun operasi inventori (stock in, stock out via penjualan, dan stock adjustment) dengan engine sinkronisasi delta offline/online yang robust, toleran 1-3 device concurrent, serta warning stok minus yang tidak menghentikan alur kasir.

</domain>

<decisions>
## Implementation Decisions

### Model event mutasi stok
- **D-01:** Event mutasi disimpan granular per item (bukan batched dokumen).
- **D-02:** Metadata wajib event: `id_queue`, `id_transaksi`, `id_produk`, `id_user`, `jenis_mutasi`, `delta_qty`, `logical_clock`, `client_timestamp`.
- **D-03:** `jenis_mutasi` minimal mencakup `SALES_OUT`, `STOCK_IN`, `STOCK_ADJUSTMENT`.
- **D-04:** Sinkronisasi transaksi penjualan POS dipisah ke tabel tersendiri dari tabel event mutasi stok.

### Aturan resolusi konflik lintas-device
- **D-05:** Urutan utama pemrosesan delta di server mengikuti FIFO berdasarkan urutan event diterima server.
- **D-06:** Jika dua event dianggap pada waktu yang sama, tie-break menggunakan `client_timestamp` paling kecil terlebih dahulu.
- **D-07:** Server menghitung delta stok secara beruntun/sekuensial sesuai urutan final untuk mendapatkan stok akhir.

### Warning stok minus pada POS
- **D-08:** Warning bersifat soft dan transaksi tetap bisa dilanjutkan.
- **D-09:** Warning muncul saat qty yang ditambahkan ke cart lebih besar dari stok tersedia, atau saat stok saat ini `<= 0`.
- **D-10:** Pesan warning: `Stok barang ini kurang, stock akhir akan 0 atau mines!`.
- **D-11:** Kasir dapat bypass 100% tanpa approval; tekan `Enter` pada popup dan item tetap masuk cart.

### Sync cycle, decoupling, dan recovery
- **D-12:** Alur sync wajib decoupled dari alur utama aplikasi; setelah save + opsi print/tidak print, UI kembali ke alur kasir tanpa menunggu sync.
- **D-13:** Background job/web worker menjalankan push/pull sinkronisasi periodik di belakang layar.
- **D-14:** Background sync ini wajib berjalan juga untuk menu **Stock Adjustment** dan **Stock In** (selain delta dari POS).
- **D-15:** Status queue: `pending` (siap diambil job), `sent` (sedang push), `acked` (server sukses proses), `failed` (error kritis).
- **D-16:** Error kritis (contoh: `id_produk` tidak ditemukan atau skema rusak) masuk `failed`, tidak di-auto-push ulang, tetapi data tetap tersimpan lokal untuk traceback.
- **D-17:** Retry otomatis memakai exponential backoff maksimal 5 kali; jika habis dan masih gagal, status koneksi job ditandai tidak stabil.
- **D-18:** Setelah retry cap habis, UI menampilkan tombol Retry; saat ditekan, sync dicoba ulang langsung.

### the agent's Discretion
- Detail implementasi scheduler background job (interval, jitter, trigger online/offline) dan format payload transport ditentukan saat planning/research selama tidak melanggar keputusan D-01 s.d. D-18.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product scope and requirements
- `.planning/ROADMAP.md` - Goal, scope phase 2, dan success criteria inventory + sync.
- `.planning/REQUIREMENTS.md` - Requirement target: INV-01..INV-04, SYNC-03..SYNC-06.
- `.planning/PROJECT.md` - Constraint utama: offline-first, concurrency 1-3 device, performa operasional, locale.
- `.planning/phases/01-foundation-auth-and-offline-core/01-CONTEXT.md` - Keputusan fondasi yang harus diwarisi (Dexie, queue baseline, retry/backoff, model delta).

### Existing architecture and integrations
- `.planning/codebase/STACK.md` - Stack runtime/data layer (Next.js, Prisma, Dexie).
- `.planning/codebase/ARCHITECTURE.md` - Pola arsitektur app shell, session, offline behavior.
- `.planning/codebase/INTEGRATIONS.md` - Integrasi internal/eksternal saat ini dan gap pada sync inventory.

### External specs
- No external specs - requirements and decisions are captured in local planning docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/offline/db.ts` (Dexie tables) dan `sync_queue` baseline dapat diperluas untuk event mutasi stok.
- `src/hooks/use-connectivity.ts` dapat dipakai sebagai trigger online recovery untuk background sync.
- Formatter locale di `src/features/format/*` sudah siap untuk copy warning dan tampilan operasional Indonesia.

### Established Patterns
- Offline-first dengan local persistence lebih dulu, lalu sinkronisasi saat koneksi tersedia.
- Session/local state dipisah antara state server dan state lokal; pola ini relevan untuk state sync inventory.

### Integration Points
- Menu/flow POS untuk trigger warning stok minus dan enqueue delta `SALES_OUT`.
- Menu Inventory (Stock In/Adjustment) untuk enqueue delta dan status sync.
- API sync server-side baru diperlukan untuk ingest event delta dan ack status.

</code_context>

<specifics>
## Specific Ideas

- Warning harus cepat dan tidak menghambat throughput kasir; cukup `Enter` untuk bypass.
- Proses print receipt tidak boleh menjadi blocking point untuk siklus enqueue/sync.
- Posisi sumber kebenaran operasional tetap local-first; server catch-up melalui job background.

</specifics>

<deferred>
## Deferred Ideas

- Otorisasi override warning stok minus berbasis role (owner approval) ditunda; phase ini lock ke bypass penuh oleh kasir.

</deferred>

---

*Phase: 2-Inventory and Sync Engine*
*Context gathered: 2026-05-17*
