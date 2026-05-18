---
phase: 02-inventory-and-sync-engine
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/app/api/sync/inventory-deltas/route.ts
  - src/lib/db/inventory-replay.ts
  - src/lib/offline/inventory-sync.ts
  - src/lib/offline/inventory-sync-transport.ts
  - src/lib/offline/sync-queue.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Targeted re-review of sync/replay paths still shows correctness risks in offline-to-server reconciliation. Two defects are release blockers because they can silently lose inventory updates or create duplicate/contradictory queue state under normal runtime timing.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Sync Loop Can Run Concurrently And Corrupt Queue State (**BLOCKER**)

**File:** `src/lib/offline/inventory-sync.ts:114`
**Issue:** `run()` starts `runOnePass()` without an in-flight lock (`runOnePass().catch(...)` is fire-and-forget). `setInterval` and `online` events can overlap, causing two passes to process the same pending row. One pass can `markAcked()` while another later calls `markSendFailed()`, regressing a successful row back to pending/failed and generating duplicate sends.
**Fix:**
```ts
let inFlight: Promise<void> | null = null;

const run = () => {
  if (stopped || inFlight) return;
  inFlight = runOnePass().finally(() => {
    inFlight = null;
  });
};
```

### CR-02: Missing DB Config Acks Events Without Persistence (**BLOCKER**)

**File:** `src/lib/db/inventory-replay.ts:36`
**Issue:** When `DATABASE_URL` is absent, code returns `acked` for all events and builds an in-memory stock map only. This silently confirms sync success to clients while no server-side mutation event is stored, creating unrecoverable data loss.
**Fix:**
```ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_NOT_CONFIGURED");
}
```
Then map this server error to non-2xx in API route so client keeps items pending instead of acking.

## Warnings

### WR-01: Transport Collapses 4xx/5xx Into One Retryable Error (**WARNING**)

**File:** `src/lib/offline/inventory-sync-transport.ts:23`
**Issue:** Non-OK responses are always thrown as `sync_request_failed`, discarding server `reason`/`message`. Permanent failures (e.g., invalid payload/user mismatch) are treated like transient transport failures, causing futile retries until max attempts.
**Fix:** Parse error payload and propagate typed reason (or status code) so caller can mark non-retryable cases as `failed` immediately.

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
