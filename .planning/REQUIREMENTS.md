# Requirements: Asiatek POS Web App

**Defined:** 2026-05-17
**Core Value:** Cashiers can complete end-to-end sales quickly and reliably even without internet, with automatic sync recovery when online.

## v1 Requirements

### Authentication & Session

- [ ] **AUTH-01**: User can log in with username/password based on assigned role (Owner or Cashier)
- [ ] **AUTH-02**: Logged-in user session remains active while offline on the same device
- [ ] **AUTH-03**: User can log out and clear local session safely

### POS Checkout

- [ ] **POS-01**: Cashier can search items and add item lines to cart in under 2 seconds per action on target devices
- [ ] **POS-02**: Cashier can update quantity and remove item lines before checkout
- [ ] **POS-03**: Cashier can apply item-level flat discount in POS screen
- [ ] **POS-04**: Cashier can apply order-level flat discount in POS screen
- [ ] **POS-05**: POS supports payment type `cash` and `bank transfer` (manual flag only)
- [ ] **POS-06**: `Bank transfer` payment is excluded from active cash drawer totals for the day
- [ ] **POS-07**: POS flow from item search to printed receipt can complete in under 15 seconds under normal local load
- [ ] **POS-08**: Action buttons display keyboard shortcuts, and shortcuts work in browser on supported devices
- [ ] **POS-09**: POS interface uses fast list/table layout without product images
- [ ] **POS-10**: System prints 58mm receipt through local print bridge connected to USB thermal printer

### Offline-First Data & Sync

- [ ] **SYNC-01**: All core modules (login session continuity, POS, inventory, user access enforcement, start/end day, transaction history) are usable when internet is unavailable
- [ ] **SYNC-02**: Local database persists offline transactions and updates for at least 7 days of disconnection
- [x] **SYNC-03**: System automatically syncs local changes to server when internet reconnects without manual export/import
- [x] **SYNC-04**: Sync applies delta-based stock updates and allows resulting negative stock values
- [x] **SYNC-05**: POS warns cashier before confirming a transaction that would cause or deepen negative stock
- [x] **SYNC-06**: Sync behavior remains reliable with 1-3 concurrent store devices

### Inventory Stock

- [x] **INV-01**: Authorized user can record stock in transaction
- [x] **INV-02**: Authorized user can record stock out transaction
- [x] **INV-03**: Authorized user can record stock adjustment transaction
- [x] **INV-04**: Inventory stock changes operate offline and sync automatically when online

### Start/End Day & History

- [ ] **DAY-01**: Cashier can start day with opening cash value
- [ ] **DAY-02**: Cashier can end day and view closing summary
- [ ] **DAY-03**: Closing summary separates cash total from bank transfer total
- [ ] **HIST-01**: Authorized user can view transaction history while online or offline (for locally available records)

### User Management & RBAC

- [ ] **RBAC-01**: Owner can access User Management, Dashboard Summary, POS, Start/End Day, Inventory Stock, and Transaction History
- [ ] **RBAC-02**: Cashier can access POS, Start/End Day, Inventory Stock, and Transaction History only
- [ ] **RBAC-03**: Cashier cannot access User Management and Dashboard Summary routes/actions
- [ ] **RBAC-04**: Owner can create/update/deactivate cashier users

### UI & Localization

- [ ] **UI-01**: Application is responsive and usable on desktop, tablet, and mobile browsers
- [ ] **UI-02**: Currency formatting uses IDR conventions across POS and reports
- [ ] **UI-03**: Default interface language/content for v1 is Indonesian

## v2 Requirements

### Security & Controls

- **SEC-01**: PIN re-authentication for sensitive actions (discount/override/void)
- **SEC-02**: Audit log for edits, voids, and operational changes

### Platform Expansion

- **PLAT-01**: Multi-branch support with branch-aware stock and reporting
- **PLAT-02**: Tax support (inclusive/exclusive rules and reporting)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Product-image catalog browsing in POS | Slower cashier flow than table/list-first design |
| Payment gateway or direct bank integration | Bank transfer in v1 is a manual accounting flag only |
| Tax calculation/reporting | Explicitly excluded from v1 scope |
| PIN and audit trails | Explicitly deferred to later phase |
| Multi-branch operations | v1 is single-store only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| POS-01 | Phase 3 | Pending |
| POS-02 | Phase 3 | Pending |
| POS-03 | Phase 3 | Pending |
| POS-04 | Phase 3 | Pending |
| POS-05 | Phase 3 | Pending |
| POS-06 | Phase 3 | Pending |
| POS-07 | Phase 3 | Pending |
| POS-08 | Phase 3 | Pending |
| POS-09 | Phase 3 | Pending |
| POS-10 | Phase 3 | Pending |
| SYNC-01 | Phase 1 | Pending |
| SYNC-02 | Phase 1 | Pending |
| SYNC-03 | Phase 2 | Complete |
| SYNC-04 | Phase 2 | Complete |
| SYNC-05 | Phase 2 | Complete |
| SYNC-06 | Phase 2 | Complete |
| INV-01 | Phase 2 | Complete |
| INV-02 | Phase 2 | Complete |
| INV-03 | Phase 2 | Complete |
| INV-04 | Phase 2 | Complete |
| DAY-01 | Phase 4 | Pending |
| DAY-02 | Phase 4 | Pending |
| DAY-03 | Phase 4 | Pending |
| HIST-01 | Phase 4 | Pending |
| RBAC-01 | Phase 5 | Pending |
| RBAC-02 | Phase 5 | Pending |
| RBAC-03 | Phase 5 | Pending |
| RBAC-04 | Phase 5 | Pending |
| UI-01 | Phase 1 | Pending |
| UI-02 | Phase 1 | Pending |
| UI-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ?

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 after roadmap mapping*
