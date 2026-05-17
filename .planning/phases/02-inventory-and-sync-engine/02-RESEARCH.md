# Phase 2: Inventory and Sync Engine - Research

**Researched:** 2026-05-17  
**Domain:** Offline inventory mutation model + delta sync engine (Dexie + Next Route Handlers + Prisma)  
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
- Otorisasi override warning stok minus berbasis role (owner approval) ditunda; phase ini lock ke bypass penuh oleh kasir.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INV-01 | Authorized user can record stock in transaction | Local mutation event schema + queue status model + API ingest contract |
| INV-02 | Authorized user can record stock out transaction | `SALES_OUT` event type + sequential server apply |
| INV-03 | Authorized user can record stock adjustment transaction | `STOCK_ADJUSTMENT` event type + background sync for adjustment path |
| INV-04 | Inventory stock changes operate offline and auto-sync online | Dexie-first writes + retry/backoff + reconnect trigger |
| SYNC-03 | Auto-sync local changes after reconnection | Connectivity signal + periodic worker pull/push cycle |
| SYNC-04 | Delta sync and allow negative stock | Event delta model + no hard stop on negative stock |
| SYNC-05 | Warn before confirm negative/deeper negative stock | Soft warning contract and keyboard bypass behavior |
| SYNC-06 | Reliable sync with 1-3 concurrent devices | FIFO + deterministic tie-break + server-side sequential apply |
</phase_requirements>

## Summary

Phase 2 should be planned as an event-driven offline-first subsystem, not as direct stock-overwrite CRUD. Use local append-first mutation events in Dexie, push those events to server in deterministic order, and materialize stock balances by replaying deltas server-side. This is aligned with locked decisions D-01..D-18 and with existing project baseline (`syncQueue`, connectivity polling, Dexie local DB). [VERIFIED: codebase grep]

For browser execution, plan for app-managed background sync loop (interval + online trigger), not pure Background Sync API dependency, because Background Sync API is limited availability across major browsers. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API] Use service worker capability only as enhancement, not as sole execution path. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API]

On server apply path, use Prisma transaction boundaries and sequential operations so each accepted event is idempotent and order-preserving. Prisma supports sequential `$transaction` operations and configurable isolation level; this is enough to enforce deterministic stock ledger updates for the 1-3 device concurrency target. [CITED: https://www.prisma.io/docs/orm/prisma-client/queries/transactions]

**Primary recommendation:** Plan this phase around a canonical `inventory_mutation_event` ledger + resilient queue processor loop, with deterministic server replay and explicit queue terminal states.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mutation capture (Stock In/Out/Adjustment) | Browser / Client | Database / Storage | User action originates in UI; append-first local persistence ensures offline continuity. [VERIFIED: codebase grep] |
| Queue state machine (`pending/sent/acked/failed`) | Browser / Client | Database / Storage | Queue execution and retries run in client runtime while records persist in IndexedDB via Dexie. [VERIFIED: codebase grep] |
| Sync transport endpoint | API / Backend | Frontend Server (SSR) | Route handlers receive batched deltas and return ack/error contract. [CITED: https://nextjs.org/docs/app/building-your-application/routing/route-handlers] |
| Conflict ordering and final stock apply | API / Backend | Database / Storage | Final order and stock materialization must be authoritative and transactional server-side. [CITED: https://www.prisma.io/docs/orm/prisma-client/queries/transactions] |
| Negative stock warning UX | Browser / Client | - | Warning + bypass is explicit cashier interaction requirement (soft warning). [VERIFIED: .planning/phases/02-inventory-and-sync-engine/02-CONTEXT.md] |

## Project Constraints (from AGENTS.md)

- Use GSD workflow entry points before file-changing actions unless explicitly bypassed by user. [VERIFIED: AGENTS.md]  
- Core architecture target is PWA + local DB + background sync, offline up to 7 days. [VERIFIED: AGENTS.md]  
- Sync/stock logic must tolerate 1-3 concurrent devices. [VERIFIED: AGENTS.md]  
- Receipt print bridge remains mandatory checkout path (integration boundary awareness). [VERIFIED: AGENTS.md]  
- Indonesian localization and IDR formatting are non-optional. [VERIFIED: AGENTS.md]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `dexie` | `4.4.2` (npm modified 2026-04-16) | IndexedDB wrapper for local-first event/queue persistence | Existing project baseline + transaction API and offline-first model. [VERIFIED: npm registry] [CITED: https://dexie.org/docs] |
| `next` Route Handlers | `16.2.6` in repo | Sync ingest/ack API endpoints in App Router | Native request/response handlers in current architecture. [VERIFIED: codebase grep] [CITED: https://nextjs.org/docs/app/building-your-application/routing/route-handlers] |
| `prisma` + `@prisma/client` | `6.9.0` in repo (`7.8.0` latest registry as of 2026-05-17) | Transactional server replay of deltas and stock projection updates | Existing ORM baseline; supports sequential and interactive transactions. [VERIFIED: npm registry] [CITED: https://www.prisma.io/docs/orm/prisma-client/queries/transactions] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `4.4.3` (npm modified 2026-05-04) | Payload schema validation for sync endpoint and queue payload decode | Use if current API payload validation is still ad-hoc. [VERIFIED: npm registry] [ASSUMED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| App-managed sync loop | Service Worker Background Sync only | Not reliable cross-browser; limited availability. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API] |
| Dexie local queue | Hand-written raw IndexedDB wrapper | Higher complexity and more error-prone transaction handling. [CITED: https://dexie.org/docs/The-Main-Limitations-of-IndexedDB] |

**Installation:**
```bash
# Only if payload validation is added in this phase:
npm install zod
```

**Version verification:**
```bash
npm view dexie version
npm view prisma version
npm view @prisma/client version
npm view zod version
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| dexie | npm | Mature (multi-year) | high [ASSUMED] | https://github.com/dexie/Dexie.js [ASSUMED] | OK | Approved |
| prisma | npm | Mature (multi-year) | high [ASSUMED] | https://github.com/prisma/prisma [ASSUMED] | OK | Approved |
| @prisma/client | npm | Mature (multi-year) | high [ASSUMED] | https://github.com/prisma/prisma [ASSUMED] | OK | Approved |
| zod | npm | Mature (multi-year) | high [ASSUMED] | https://github.com/colinhacks/zod [ASSUMED] | OK | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
[Cashier action: stock in/out/adjust]
        |
        v
[Client mutation builder]
  - attach id_queue, id_transaksi, id_produk, id_user
  - jenis_mutasi, delta_qty, logical_clock, client_timestamp
        |
        v
[Dexie transaction]
  -> write mutation_event table
  -> enqueue sync_queue(status=pending)
        |
        v
[Background sync loop]
  triggers: interval + online event + manual Retry
        |
        +--> if no network: keep pending, schedule nextRetryAt
        |
        v
[POST /api/sync/inventory-deltas]
        |
        v
[Server orderer]
  FIFO(received_at), tie-break(client_timestamp)
        |
        v
[Prisma transaction]
  -> idempotency check by id_queue
  -> append server ledger
  -> recompute/update stock projection
        |
        v
[ACK map per event]
        |
        v
[Client queue updater]
  acked | failed(critical) | pending retry (max 5 backoff)
```

### Recommended Project Structure
```text
src/
|-- features/inventory/          # stock in/out/adjustment UI + warning logic
|-- lib/offline/                 # dexie schema, queue repo, sync scheduler
|-- app/api/sync/                # delta ingest + pull endpoints
|-- lib/inventory/               # mutation DTO, ordering, reconciliation helpers
`-- lib/db/                      # prisma transaction layer and stock projection writes
```

### Pattern 1: Append-Only Mutation Ledger
**What:** Store every stock change as immutable delta event; derive stock from replay/projection. [VERIFIED: .planning/phases/02-inventory-and-sync-engine/02-CONTEXT.md]  
**When to use:** Any offline write path requiring conflict tolerance and auditability.  
**Example:**
```typescript
// Source: local pattern + locked fields from 02-CONTEXT.md
await db.transaction("rw", db.inventoryMutationEvents, db.syncQueue, async () => {
  await db.inventoryMutationEvents.add(event);
  await db.syncQueue.add({ status: "pending", entityType: "inventory_mutation", entityId: event.id_queue });
});
```

### Pattern 2: Deterministic Server Replay
**What:** Apply accepted events sequentially in one transaction scope per batch. [CITED: https://www.prisma.io/docs/orm/prisma-client/queries/transactions]  
**When to use:** Prevent divergent stock totals under concurrent device pushes.  
**Example:**
```typescript
// Source: Prisma transaction docs
await prisma.$transaction(async (tx) => {
  for (const ev of orderedEvents) {
    // check idempotency key first
    // then apply delta to projection
  }
});
```

### Anti-Patterns to Avoid
- **Stock overwrite sync:** Sending absolute stock value from device creates lost updates under concurrency; use deltas only. [VERIFIED: .planning/phases/02-inventory-and-sync-engine/02-CONTEXT.md]
- **Network call inside long Dexie transaction scope:** can trigger transaction inactivity issues; keep DB transaction short and pure DB-first. [CITED: https://dexie.org/docs/Tutorial/Best-Practices]
- **Relying only on `navigator.onLine`:** property is unreliable; always use health probe or sync attempt result. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB low-level transaction plumbing | Custom IDB wrapper | Dexie transaction/table APIs | Avoids brittle error/event handling edge cases. [CITED: https://dexie.org/docs/The-Main-Limitations-of-IndexedDB] |
| Request parsing for App Router sync APIs | Legacy API-route style body parsing | Native Route Handler `Request`/`Response` APIs | Official App Router path; simpler and standard. [CITED: https://nextjs.org/docs/app/building-your-application/routing/route-handlers] |
| Sync persistence in `localStorage` | Stringified queue blobs | Dexie/IndexedDB tables | Better capacity and queryability for 7-day offline window. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria] |

**Key insight:** Inventory sync failures are mostly state-model failures; using standard event+queue primitives prevents expensive phase-3 rewrites.

## Common Pitfalls

### Pitfall 1: Queue Stuck in `sent`
**What goes wrong:** Events remain `sent` forever after request timeout/interruption.  
**Why it happens:** Missing terminal transition policy after transport errors.  
**How to avoid:** Treat transport timeout as retryable, move back to `pending` with backoff; reserve `failed` for critical semantic errors only (D-16). [VERIFIED: .planning/phases/02-inventory-and-sync-engine/02-CONTEXT.md]  
**Warning signs:** `sent` count grows while `acked` flatlines.

### Pitfall 2: Duplicate Event Apply
**What goes wrong:** Same delta applied twice after reconnect retries.  
**Why it happens:** No idempotency check keyed by `id_queue`.  
**How to avoid:** Unique constraint/idempotency gate before apply in transaction. [ASSUMED]  
**Warning signs:** Projection stock drifts after unstable network periods.

### Pitfall 3: Offline Data Loss by Storage Pressure
**What goes wrong:** IndexedDB data evicted by browser under storage pressure.  
**Why it happens:** Best-effort browser storage defaults and quota limits.  
**How to avoid:** Keep payload compact, monitor usage, optionally request persistent storage. [CITED: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria]  
**Warning signs:** Sudden missing local history despite no app-level delete.

## Code Examples

### Connectivity-aware trigger (existing pattern)
```typescript
// Source: /src/hooks/use-connectivity.ts
window.addEventListener("online", sync);
window.addEventListener("offline", sync);
setInterval(() => sync().catch(() => undefined), 5000);
```

### Retry backoff (existing pattern)
```typescript
// Source: /src/lib/offline/sync-queue.ts
const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attemptCount - 1), MAX_BACKOFF_MS);
```

### Route Handler sync endpoint skeleton
```typescript
// Source: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({ ok: true });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Online-only stock update | Local-first append + eventual sync | Ongoing modern PWA practice [ASSUMED] | Maintains cashier continuity offline |
| Depend solely on Background Sync API | App-managed sync scheduler + optional SW enhancement | Browser support reality as of MDN update (2024-04-22 page mod date) | Predictable behavior on unsupported browsers |

**Deprecated/outdated:**
- Hard-blocking checkout when stock negative for this project scope: conflicts with locked decision D-08..D-11. [VERIFIED: .planning/phases/02-inventory-and-sync-engine/02-CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `zod` should be added for sync payload validation | Standard Stack | Adds unnecessary dependency if existing validation approach is preferred |
| A2 | Idempotency unique key should be `id_queue` at server storage layer | Common Pitfalls | Wrong key choice could still permit duplicate applies |
| A3 | Download popularity and repo links in package audit are high/mature | Package Legitimacy Audit | Low operational risk; mostly governance metadata |

## Open Questions

1. **Server authoritative order persistence**
   - What we know: FIFO receive order + `client_timestamp` tie-break is locked.
   - What's unclear: Exact DB columns (`received_at`, `server_seq`) and index strategy.
   - Recommendation: Lock explicit schema/index in Phase 2 plan wave 1.

2. **Pull strategy for projection refresh**
   - What we know: Push/pull background sync is locked.
   - What's unclear: Pull by watermark (`last_server_seq`) vs time window.
   - Recommendation: Prefer monotonically increasing server sequence watermark. [ASSUMED]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next API + tooling | yes | v22.20.0 | - |
| npm | Package operations | yes | 11.10.0 | pnpm |
| pnpm | Workspace package manager | yes | 11.1.1 | npm |
| Python + pip | slopcheck legitimacy gate | yes | 3.14.4 / pip 26.0.1 | Mark packages `[ASSUMED]` if unavailable |
| Docker | Optional local infra workflows | yes | 26.1.4 | Native local services |

**Missing dependencies with no fallback:**
- none

**Missing dependencies with fallback:**
- `ctx7` CLI not installed; used official docs/web fallback in this research. [VERIFIED: local command check]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | none detected (Playwright dependency exists, no suite configured) |
| Config file | none - see Wave 0 |
| Quick run command | `npm run lint` |
| Full suite command | `npm run lint` (current only) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INV-01 | Stock in mutation stored and queued offline | unit/integration | `npm run lint` now; add targeted test command in Wave 0 | NO (Wave 0) |
| INV-02 | Stock out mutation path | unit/integration | `npm run lint` now; add targeted test command in Wave 0 | NO (Wave 0) |
| INV-03 | Stock adjustment mutation path | unit/integration | `npm run lint` now; add targeted test command in Wave 0 | NO (Wave 0) |
| INV-04 | Offline-to-online auto-sync | integration/e2e | `npm run lint` now; add sync harness in Wave 0 | NO (Wave 0) |
| SYNC-03 | Reconnect auto push | integration | `npm run lint` now; add reconnect test in Wave 0 | NO (Wave 0) |
| SYNC-04 | Delta apply and allow negative stock | unit/integration | `npm run lint` now; add ledger apply tests in Wave 0 | NO (Wave 0) |
| SYNC-05 | Negative-stock warning before confirm | component/e2e | `npm run lint` now; add UI test in Wave 0 | NO (Wave 0) |
| SYNC-06 | 1-3 device concurrency reliability | integration | `npm run lint` now; add multi-client simulation in Wave 0 | NO (Wave 0) |

### Sampling Rate
- **Per task commit:** `npm run lint`
- **Per wave merge:** `npm run lint` + phase-specific sync tests (to be created)
- **Phase gate:** Lint + sync/inventory test suite green before `$gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/inventory/mutation-queue.spec.ts` - INV-01, INV-02, INV-03
- [ ] `tests/sync/reconnect-backoff.spec.ts` - SYNC-03, SYNC-06
- [ ] `tests/sync/negative-stock-warning.spec.tsx` - SYNC-05
- [ ] `tests/sync/server-replay-order.spec.ts` - SYNC-04, SYNC-06
- [ ] Add test runner config and scripts (Vitest or Playwright test package strategy) [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Reuse Phase 1 authenticated session checks on inventory APIs. [VERIFIED: codebase grep] |
| V3 Session Management | yes | Maintain server cookie + local session policy; reject unauthenticated sync posts. [VERIFIED: codebase grep] |
| V4 Access Control | yes | Enforce role checks (`OWNER`/`CASHIER`) on stock mutation endpoints. [ASSUMED] |
| V5 Input Validation | yes | Validate sync payload schema and enum values before apply. [ASSUMED] |
| V6 Cryptography | no (phase core) | No new crypto primitive needed; reuse existing auth/session crypto components. [VERIFIED: codebase grep] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Replayed delta request | Tampering | Idempotency key (`id_queue`) uniqueness + transaction check. [ASSUMED] |
| Unauthorized stock mutation submit | Elevation of Privilege | Authn/authz middleware or explicit session+role verification in Route Handlers. [CITED: https://nextjs.org/docs/app/building-your-application/routing/route-handlers] |
| Payload schema poisoning | Tampering | Strict request schema validation + reject unknown fields. [ASSUMED] |

## Sources

### Primary (HIGH confidence)
- Local codebase files (`src/lib/offline/db.ts`, `src/lib/offline/sync-queue.ts`, `src/hooks/use-connectivity.ts`, `package.json`, `.planning/*`) - existing architecture and constraints.
- Dexie docs: https://dexie.org/docs
- Prisma transactions docs: https://www.prisma.io/docs/orm/prisma-client/queries/transactions
- Next Route Handlers docs: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- MDN Navigator online reliability: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
- MDN Background Sync API: https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
- MDN Storage quotas/eviction: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

### Secondary (MEDIUM confidence)
- Dexie best practices transaction caveats: https://dexie.org/docs/Tutorial/Best-Practices
- Dexie IndexedDB limitation notes: https://dexie.org/docs/The-Main-Limitations-of-IndexedDB

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - mostly existing stack + official docs/registry checks.
- Architecture: HIGH - constrained by locked phase decisions and present code baseline.
- Pitfalls: MEDIUM - some mitigations are architecture assumptions pending schema lock.

**Research date:** 2026-05-17  
**Valid until:** 2026-06-16
