---
phase: 02-inventory-and-sync-engine
reviewed: 2026-05-17T11:45:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - src/lib/offline/inventory-sync.ts
  - src/lib/offline/inventory-sync-transport.ts
  - src/lib/db/inventory-replay.ts
  - src/app/api/sync/inventory-deltas/route.ts
  - src/lib/offline/sync-queue.ts
  - tests/sync/reconnect-backoff.spec.ts
  - tests/sync/server-replay-order.spec.ts
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-17T11:45:00Z
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Deep review of inventory sync queueing, transport, API validation, replay transaction behavior, and reconnect/order tests found correctness and security defects. The highest-risk issues are irreversible client-side failure on auth expiry (causing unsynced deltas to stop auto-retrying) and server-side leakage of raw database error strings to clients.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: 401/403 Sync Responses Permanently Dead-Letter Queue Items

**Classification:** BLOCKER  
**File:** `src/lib/offline/inventory-sync.ts:41`, `src/lib/offline/inventory-sync.ts:95-101`  
**Issue:** `401` and `403` are treated as non-retryable transport failures and immediately marked `failed`. In practice, expired session cookies are recoverable after re-login, but these rows stop automatic retry and require manual intervention. This creates real inventory divergence risk after routine auth expiry.
**Fix:**
```ts
// Treat auth failures as retryable-after-refresh, not permanent failure.
const NON_RETRYABLE_TRANSPORT_STATUS = new Set([400, 404, 422]);

// Optional: add dedicated auth-pending status to surface "reauth required".
if (error instanceof InventorySyncTransportError && error.status === 401) {
  await markSendFailed(row.id); // keep in retry pipeline with backoff
  continue;
}
```

### CR-02: Raw Database Error Messages Are Returned to Client

**Classification:** BLOCKER  
**File:** `src/lib/db/inventory-replay.ts:76-78`, `src/app/api/sync/inventory-deltas/route.ts:72-76`  
**Issue:** replay catches exceptions and returns `error.message` in ack reasons; route forwards `replay.acks` directly to client. Prisma/database messages can expose internal schema details and operational state.
**Fix:**
```ts
// inventory-replay.ts
catch (error) {
  const reason = mapReplayErrorToCode(error); // e.g. PRODUCT_NOT_FOUND, REPLAY_WRITE_FAILED
  acks.push({ id_queue: event.id_queue, status: "failed", reason });
}

function mapReplayErrorToCode(error: unknown): string {
  if (error instanceof Error && error.message === "MISSING_USER_ID") return "MISSING_USER_ID";
  return "REPLAY_WRITE_FAILED";
}
```

## Warnings

### WR-01: Numeric Validation Accepts Invalid Domain Values

**Classification:** WARNING  
**File:** `src/app/api/sync/inventory-deltas/route.ts:55-58`  
**Issue:** `Number.isFinite` allows negative/float/overflow values for `received_seq`, `logical_clock`, and `client_timestamp`. This can break ordering guarantees and produce replay failures that are avoidable at validation boundary.
**Fix:**
```ts
const isPositiveInt = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
const isValidTs = (n: unknown) => Number.isInteger(n) && (n as number) > 0;

!isPositiveInt(event.received_seq) ||
!isPositiveInt(event.logical_clock) ||
!isValidTs(event.client_timestamp)
```

### WR-02: Unbounded Event Batch Size Enables Easy Resource Exhaustion

**Classification:** WARNING  
**File:** `src/app/api/sync/inventory-deltas/route.ts:44-46`  
**Issue:** API accepts arbitrarily large `events` arrays. A single authenticated request can drive long DB transactions and increased memory/CPU, degrading sync availability.
**Fix:**
```ts
const MAX_EVENTS_PER_BATCH = 200;
if (body.events.length > MAX_EVENTS_PER_BATCH) {
  return NextResponse.json(
    { ok: false, results: [], message: "Batch terlalu besar." },
    { status: 413 },
  );
}
```

### WR-03: Replay-Ordering Test Never Exercises Successful Path

**Classification:** WARNING  
**File:** `tests/sync/server-replay-order.spec.ts:7-75`  
**Issue:** test inputs omit `id_user`, but replay requires it (`MISSING_USER_ID`). Assertions currently pass on failure ordering only, so they do not verify the intended “sequential apply” behavior under valid payloads. This weakens regression detection.
**Fix:**
```ts
const input = [
  { ..., id_user: "u-1" },
  { ..., id_user: "u-1" },
  { ..., id_user: "u-1" },
];
// Assert appliedOrder and finalStockByProduct on a seeded test DB, or mock tx layer.
```

---

_Reviewed: 2026-05-17T11:45:00Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: deep_
