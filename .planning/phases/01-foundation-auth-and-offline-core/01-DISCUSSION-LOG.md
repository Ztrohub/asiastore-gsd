# Phase 1: Foundation, Auth, and Offline Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 1-Foundation, Auth, and Offline Core
**Areas discussed:** Strategi autentikasi offline, Kebijakan session continuity, Arsitektur local database dan sinkronisasi, App shell responsif dan keyboard baseline, Standar lokalisasi Indonesia

---

## Strategi autentikasi offline

| Option | Description | Selected |
|--------|-------------|----------|
| Login online only | Offline hanya mempertahankan sesi aktif yang sudah ada | |
| Returning-user offline login | User yang pernah login boleh login offline via kredensial lokal terenkripsi | ✓ |
| All-offline login | Semua login boleh offline | |

**User's choice:** Returning-user offline login.
**Notes:** Perubahan password/role diberlakukan setelah sinkronisasi online; jika user yang sedang login berubah, user harus login ulang.

---

## Kebijakan session continuity

| Option | Description | Selected |
|--------|-------------|----------|
| Idle timeout | Auto lock/logout setelah periode idle | ✓ |
| Hard max session | Re-login wajib pada jadwal tertentu | ✓ |
| Reopen behavior | Perilaku saat app dibuka ulang offline | ✓ |

**User's choice:** Idle timeout 6 jam; re-login wajib hari Senin (tetap bisa offline); app reopen langsung masuk jika sesi valid.
**Notes:** Menjaga keamanan dasar tanpa memblokir operasi offline.

---

## Arsitektur local database dan sinkronisasi

| Option | Description | Selected |
|--------|-------------|----------|
| IndexedDB + Dexie | Local DB dengan ORM ringan dan tabel queue | ✓ |
| IndexedDB manual wrapper | Implementasi custom tanpa Dexie | |
| Retry strategy | Immediate + exponential backoff | ✓ |

**User's choice:** IndexedDB + Dexie, `sync_queue` append-only status `pending/sent/acked/failed`, retry immediate + exponential backoff.
**Notes:** Konflik sync diarahkan ke model delta dengan dukungan stok minus.

---

## App shell responsif dan keyboard baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Layout priority | Desktop-first, lalu adaptif tablet/mobile | ✓ |
| Breakpoint set | >=1024 desktop, 768-1023 tablet, <768 mobile | ✓ |
| Keyboard baseline | Shortcut domain POS dan navigasi list | ✓ |

**User's choice:** Desktop-first + breakpoint yang ditentukan + shortcut POS spesifik.
**Notes:** Shortcut lintas POS: ketik langsung cari produk, arrow keys untuk fokus list/item, Enter proses item, plus void/cash/transfer.

---

## Standar lokalisasi Indonesia

| Option | Description | Selected |
|--------|-------------|----------|
| IDR formatting | Tanpa desimal | ✓ |
| Locale default | `id-ID` untuk semua formatter | ✓ |
| Timezone and datetime | `Asia/Jakarta`, `dd-mm-yyyy hh:mm:ss` | ✓ |

**User's choice:** IDR tanpa desimal, locale `id-ID`, timezone `Asia/Jakarta` dengan format datetime tetap.
**Notes:** Lokalitas menjadi baseline fondasi, bukan tambahan belakangan.

---

## the agent's Discretion

- Detail teknis enkripsi kredensial lokal dan key mapping final diserahkan ke planning/research dengan batas keputusan user.

## Deferred Ideas

- Detail action checkout penuh untuk shortcut `void/cash/transfer` diperdalam di fase POS Checkout agar fase 1 tetap fokus foundation.
