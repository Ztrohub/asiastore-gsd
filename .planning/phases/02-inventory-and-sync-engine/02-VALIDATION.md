---
phase: 2
slug: inventory-and-sync-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 2 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` (phase target) |
| **Config file** | `vitest.config.ts` (Wave 0 installs if missing) |
| **Quick run command** | `npm run test -- --runInBand --reporter=dot` |
| **Full suite command** | `npm run test -- --runInBand && npm run lint` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --runInBand --reporter=dot`
- **After every plan wave:** Run `npm run test -- --runInBand && npm run lint`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 02-01 | 1 | INV-01, INV-03 | T-02-01 | Mutation event includes D-02 keys and only allowed jenis_mutasi values | unit | `npm run test -- tests/inventory/mutation-queue.spec.ts` | ? W0 | ? pending |
| 2-01-02 | 02-01 | 1 | SYNC-05 | T-02-02 | Warning shown on D-09 conditions, Enter bypass continues flow | component | `npm run test -- tests/sync/negative-stock-warning.spec.tsx` | ? W0 | ? pending |
| 2-01-03 | 02-01 | 1 | INV-01, INV-03, SYNC-05 | T-02-03 | Prisma schema and local DB stay consistent after push | integration | `npx prisma db push && npm run test -- tests/inventory/mutation-queue.spec.ts tests/sync/negative-stock-warning.spec.tsx && npm run lint` | ? | ? pending |
| 2-02-01 | 02-02 | 2 | SYNC-03, SYNC-06 | T-02-06 | Reconnect auto-push and retry cap/manual retry behavior are deterministic | integration | `npm run test -- tests/sync/reconnect-backoff.spec.ts` | ? W0 | ? pending |
| 2-02-02 | 02-02 | 2 | INV-02, INV-04, SYNC-04, SYNC-06 | T-02-04 / T-02-05 | Authenticated ingest + FIFO/tie-break replay + sequential transactional apply | integration | `npm run test -- tests/sync/server-replay-order.spec.ts` | ? W0 | ? pending |
| 2-02-03 | 02-02 | 2 | INV-02, INV-04, SYNC-03, SYNC-04, SYNC-06 | T-02-04, T-02-05, T-02-06 | End-to-end slice remains green with lint gate | integration | `npm run test -- tests/sync/reconnect-backoff.spec.ts tests/sync/server-replay-order.spec.ts && npm run lint` | ? | ? pending |

*Status: ? pending · ? green · ? red · ?? flaky*

---

## Wave 0 Requirements

- [ ] `tests/inventory/mutation-queue.spec.ts` - stubs for INV-01, INV-03
- [ ] `tests/sync/negative-stock-warning.spec.tsx` - stubs for SYNC-05
- [ ] `tests/sync/reconnect-backoff.spec.ts` - stubs for SYNC-03, SYNC-06
- [ ] `tests/sync/server-replay-order.spec.ts` - stubs for SYNC-04, SYNC-06
- [ ] `vitest.config.ts` and test scripts in `package.json` if test runner missing

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cashier keyboard flow can bypass warning with Enter without throughput slowdown | SYNC-05 | Requires real-device interaction timing and human UX judgment | Open stock mutation form, force negative stock condition, press Enter on warning, confirm item remains in flow and operator can continue immediately |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
