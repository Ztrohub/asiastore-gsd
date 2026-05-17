# Roadmap: Asiatek POS Web App

**Created:** 2026-05-17
**Granularity:** coarse
**Structure:** Vertical MVP

## Summary

- Total phases: 5
- v1 requirements mapped: 34/34
- Unmapped requirements: 0

### Phase 1: Foundation, Auth, and Offline Core

**Goal:** Establish the offline-first application foundation, authentication/session continuity, and responsive shell so every next feature is stable across desktop/tablet/mobile.
**Mode:** mvp
**Requirements:** AUTH-01, AUTH-02, AUTH-03, SYNC-01, SYNC-02, UI-01, UI-02, UI-03
**Success Criteria**:

1. Users can log in and keep session active while offline on the same device.
2. Core app shell and local database are available offline for at least 7 days of normal use.
3. Responsive layout works on Windows desktop browsers and Android tablet/mobile browsers.
4. Indonesian language and IDR formatting are consistently applied.

### Phase 2: Inventory and Sync Engine

**Goal:** As a owner toko, I want to mencatat stock in, stock out, dan stock adjustment secara offline dengan sinkronisasi otomatis saat online, so that stok tetap akurat lintas 1-3 device dan operasional toko tetap jalan saat internet putus.
**Mode:** mvp
**Requirements:** INV-01, INV-02, INV-03, INV-04, SYNC-03, SYNC-04, SYNC-05, SYNC-06
**Plans:** 2/2 plans complete
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Offline stock in/adjust mutation slice with soft negative-stock warning and schema push gate

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — POS stock-out plus background sync/replay slice for deterministic multi-device delta processing

**Success Criteria**:

1. Authorized users can perform stock in/out/adjustments offline and online.
2. Local inventory changes automatically sync to server after reconnection.
3. Delta sync tolerates 1-3 concurrent devices and allows negative stock state.
4. Cashier sees clear warning before confirming transactions that cause/deepen negative stock.

### Phase 02.1: Menu Inventory untuk user di UI: tambah produk, atur harga, stock in, stock adjustment (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 2
**Plans:** 0/3 plans executed

Plans:
- [ ] TBD (run /gsd-plan-phase 02.1 to break down)

### Phase 3: POS Checkout and Receipt Printing

**Goal:** Implement high-speed cashier POS workflow with keyboard-first operation, discounts, payment handling, and local bridge receipt printing.
**Mode:** mvp
**Requirements:** POS-01, POS-02, POS-03, POS-04, POS-05, POS-06, POS-07, POS-08, POS-09, POS-10
**Success Criteria**:

1. Cashier can search/add/update/remove cart items using list/table POS with keyboard shortcuts shown on actions.
2. Item action latency is under 2 seconds and search-to-printed-receipt flow is under 15 seconds in expected environment.
3. Cash and manual bank transfer are supported, with bank transfer excluded from active cash drawer totals.
4. 58mm receipt printing works from browser app via local print bridge to USB thermal printer.

### Phase 4: Daily Operations and Transaction Visibility

**Goal:** Complete day-start/day-end operational controls and offline-capable transaction history access for cashier and owner workflows.
**Mode:** mvp
**Requirements:** DAY-01, DAY-02, DAY-03, HIST-01
**Success Criteria**:

1. Cashier can start day with opening cash and end day with closing summary.
2. Closing summary separates cash total from bank transfer total.
3. Transaction history remains available offline for locally stored records and syncs when online.

### Phase 5: RBAC and User Management

**Goal:** Enforce role-based access boundaries and owner-managed cashier account lifecycle.
**Mode:** mvp
**Requirements:** RBAC-01, RBAC-02, RBAC-03, RBAC-04
**Success Criteria**:

1. Owner has full access to required menus; cashier has only allowed modules.
2. Unauthorized route and action attempts are blocked consistently online/offline.
3. Owner can create, update, and deactivate cashier users.

## Notes

- This roadmap intentionally prioritizes operational reliability and cashier speed over advanced governance/security controls in v1.
- Deferred controls (PIN/audit log) remain in v2 requirements.

---
*Last updated: 2026-05-17 after initial roadmap creation*
