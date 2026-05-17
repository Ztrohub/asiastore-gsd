---
phase: 02-inventory-and-sync-engine
plan: "02"
subsystem: sync-engine
tags: [inventory, offline-sync, replay, retry, vitest]
requires:
  - phase: 02-inventory-and-sync-engine
    plan: "01"
    provides: inventory mutation event schema and queue baseline
provides:
  - POS stock-out mutation capture as SALES_OUT events
  - Background inventory sync loop with reconnect and retry exhaustion status
  - Authenticated inventory delta ingest route with deterministic replay apply
affects: [phase-2-sync-engine, phase-3-pos-checkout]
tech-stack:
  added: []
  patterns: [local-first mutation enqueue, background retry loop, FIFO replay ordering]
key-files:
  created:
    - src/features/pos/hooks/use-stock-out-mutation.ts
    - src/lib/offline/inventory-sync.ts
    - src/lib/offline/inventory-sync-transport.ts
    - src/app/api/sync/inventory-deltas/route.ts
    - src/lib/db/inventory-replay.ts
    - tests/sync/reconnect-backoff.spec.ts
    - tests/sync/server-replay-order.spec.ts
  modified:
    - src/lib/inventory/mutation-event.ts
    - src/lib/offline/sync-queue.ts
decisions:
  - "Use browser-managed periodic and online-triggered sync loop to keep cashier flow non-blocking."
  - "Apply replay ordering by server FIFO sequence, then client timestamp tie-break."
metrics:
  duration: 16min
  completed: 2026-05-17
---

# Phase 2 Plan 02: Sync Reliability Slice Summary

**POS stock-out deltas now flow from local queue to authenticated replay endpoint with deterministic ordering and reconnect retry controls.**

## Task Commits
1. Task 1 (RED tests): `50d0806`
2. Task 2 (implementation): `d740138`
3. Task 3 (verification): `41530fb`

## Verification
- `npm run test -- tests/sync/reconnect-backoff.spec.ts tests/sync/server-replay-order.spec.ts` passed.
- `npm run lint` passed.

## Delivered Behaviors
- Added `use-stock-out-mutation` to persist `SALES_OUT` mutation events with D-02 metadata and enqueue `pending` sync rows.
- Added `startInventorySyncLoop` and `retryInventorySyncNow` with background periodic and online-triggered processing.
- Added retry-cap status signaling (`maxAttempts=5`, unstable/retryExhausted flags, manual retry capability state).
- Added `POST /api/sync/inventory-deltas` with session authentication guard and per-event ack/failure response contract.
- Added deterministic replay service applying events in FIFO receive order with client timestamp tie-break and sequential apply model, including negative-stock outcomes.

## Deviations from Plan
### Auto-fixed Issues
1. [Rule 1 - Bug] Corrected initial sync loop error-path transition behavior.
- Found during: Task 2
- Issue: Error-path attempt transitions were not coherent with expected queue-state semantics.
- Fix: Simplified failure branch to single failed-attempt transition and explicit exhaustion handling.
- Files modified: `src/lib/offline/inventory-sync.ts`
- Commit: `d740138`

2. [Rule 3 - Blocking] Adjusted reconnect test harness mocks/timers for deterministic execution.
- Found during: Task 2 verification
- Issue: Infinite fake-timer loop and missing mocked export prevented behavior validation.
- Fix: Added missing `markFailed` mock and switched to bounded timer advancement.
- Files modified: `tests/sync/reconnect-backoff.spec.ts`
- Commit: `d740138`

## Auth Gates
None.

## Known Stubs
None.

## Self-Check: PASSED
- FOUND: .planning/phases/02-inventory-and-sync-engine/02-02-SUMMARY.md
- FOUND: 50d0806
- FOUND: d740138
- FOUND: 41530fb
