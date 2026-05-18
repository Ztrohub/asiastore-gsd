# Phase 3: POS Checkout and Receipt Printing - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Membangun alur checkout POS yang cepat dan keyboard-first (search -> cart -> payment -> receipt), termasuk diskon, metode pembayaran cash/bank transfer, dan cetak struk 58mm via local print bridge, dengan transaksi dianggap selesai setelah tersimpan lokal.

</domain>

<decisions>
## Implementation Decisions

### Cart interaction and keyboard flow
- **D-01:** Fokus awal POS ada di global search box; ketik langsung memfilter list produk.
- **D-02:** Navigasi list produk memakai arrow keys; `Enter` pada item membuka popup qty.
- **D-03:** `Enter` di popup qty mengonfirmasi item masuk cart.
- **D-04:** Default qty popup = `1` dan field langsung terseleksi.
- **D-05:** Setelah item masuk cart, fokus kembali ke area product list/search untuk input item berikutnya.
- **D-06:** `ArrowRight` memindahkan fokus ke list cart.
- **D-07:** `Enter` pada cart line membuka popup qty edit; `Delete` menghapus line dengan dialog konfirmasi.
- **D-08:** Dialog konfirmasi hapus: `Enter` = Ya, `Esc` = Batal.
- **D-09:** Jika hasil filter kosong, tampilkan "Produk tidak ditemukan" dan `Enter` tidak melakukan aksi.
- **D-10:** Jika stok item 0/minus, tetap boleh lanjut dengan warning popup (sesuai keputusan fase 2).
- **D-11:** Shortcut membuka pembayaran adalah `F9`.
- **D-12:** `F9` hanya valid jika cart tidak kosong; jika kosong tampil pesan "Cart masih kosong".
- **D-13:** Qty harus `> 0` dan desimal diperbolehkan.
- **D-14:** Presisi qty maksimal 1 angka desimal.
- **D-15:** Input qty menerima `.` dan `,` lalu dinormalisasi.
- **D-16:** Input dengan >1 angka desimal di-truncate ke 1 angka desimal.
- **D-17:** Ada catatan transaksi opsional per transaksi; disimpan ke data transaksi namun tidak dicetak di struk.

### Discount behavior and guardrails
- **D-18:** Urutan diskon: item-level dulu, lalu order-level.
- **D-19:** Tipe diskon v1: flat nominal IDR saja.
- **D-20:** Diskon item-level maksimal sampai nilai line item (line total tidak boleh negatif).
- **D-21:** Diskon order-level maksimal sampai subtotal setelah diskon item (total akhir minimum 0).

### Payment capture and cash drawer rules
- **D-22:** Pembayaran cash menggunakan input "Uang Diterima"; sistem menghitung kembalian otomatis.
- **D-23:** Nilai default "Uang Diterima" = total transaksi.
- **D-24:** Jika "Uang Diterima" < total, konfirmasi pembayaran diblokir dengan pesan nominal kurang.
- **D-25:** Pembayaran bank transfer (manual flag) tidak memerlukan field wajib tambahan.
- **D-26:** Nominal bank transfer tidak menambah kas aktif, tetapi tetap tercatat di transaksi/rekap penjualan.

### Receipt printing control path
- **D-27:** Transaksi dianggap selesai setelah kasir menyelesaikan pembayaran dan data transaksi tersimpan lokal.
- **D-28:** Setelah transaksi tersimpan, tampil popup pilihan print atau tidak print.
- **D-29:** Default popup adalah "Print".
- **D-30:** Di v1, print dilakukan 1 kali percobaan; jika gagal tampil pesan error tanpa retry.
- **D-31:** Berhasil/gagal print tidak mengubah status selesai transaksi; UI tetap kembali ke kondisi reset transaksi baru.
- **D-32:** Jika pilih tidak print, tidak perlu flag khusus receipt_printed (implisit dari tidak ada log print).
- **D-33:** Konten minimum struk: header toko, id transaksi, daftar item (qty x harga), subtotal, diskon, total, metode bayar, waktu, kasir.
- **D-34:** Format ID transaksi di struk memakai ID pendek human-readable (contoh pola `TRX-YYYYMMDD-xxxxx`).
- **D-35:** Nama item yang melebihi lebar 58mm di-wrap ke baris berikutnya.
- **D-36:** Setelah print sukses, tidak perlu feedback tambahan ke kasir.

### the agent's Discretion
- Detail desain visual popup/payment/cart, copy teks final non-kritis, dan detail layout struk 58mm (spasi/alignment) ditentukan saat planning/execution selama tidak melanggar D-01 s.d. D-36.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product scope and requirements
- `.planning/ROADMAP.md` - Goal, scope, and success criteria fase 3 POS checkout + receipt printing.
- `.planning/REQUIREMENTS.md` - Requirements POS-01..POS-10 including POS-06 cash drawer rule.
- `.planning/PROJECT.md` - Offline-first constraints, printer requirement, performance targets, and locale constraints.

### Prior locked decisions from previous phases
- `.planning/phases/01-foundation-auth-and-offline-core/01-CONTEXT.md` - Keyboard-first direction, locale/IDR, and offline baseline decisions.
- `.planning/phases/02-inventory-and-sync-engine/02-CONTEXT.md` - Soft negative-stock warning and sync/event constraints inherited by POS flow.
- `.planning/phases/02.1-menu-inventory-untuk-user-di-ui-tambah-produk-atur-harga-sto/02.1-CONTEXT.md` - Inventory UI and mutation-flow decisions that intersect with POS item/stock behavior.

### Existing architecture and codebase maps
- `.planning/codebase/STACK.md` - Runtime stack and offline/data-layer capabilities.
- `.planning/codebase/ARCHITECTURE.md` - Current route/session/offline shell behavior and integration direction.
- `.planning/codebase/CONVENTIONS.md` - UI, locale, and coding conventions to preserve.

### External specs
- No external specs - requirements and implementation direction are captured in local planning docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/offline/db.ts` and sync-related offline modules can store local transaction payload and print metadata/log stubs.
- Existing UI primitives under `src/components/ui/*` can be reused for product list, cart list, qty dialog, confirm dialog, and payment popup.
- Existing locale formatter modules can enforce IDR display consistency in cart/payment/receipt preview.

### Established Patterns
- Local-first persistence before network sync is the default pattern.
- Indonesian UI copy + IDR format are established project-wide conventions.
- Keyboard-centric interaction is a locked product direction from earlier context.

### Integration Points
- Authenticated app shell route under `src/app/app/*` will host POS page flow.
- Offline transaction write path must connect to local DB first, then hand off to sync queue/background process.
- Receipt print action must integrate with local print bridge call after local transaction commit.

</code_context>

<specifics>
## Specific Ideas

- Checkout closure should not wait for print; cashier throughput is prioritized.
- Payment popup is intentionally optimized for keyboard (`F9`, Enter flow).
- Cart edit flow is list-based (not catalog/image-based), consistent with product speed goal.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 3-POS Checkout and Receipt Printing*
*Context gathered: 2026-05-19*
