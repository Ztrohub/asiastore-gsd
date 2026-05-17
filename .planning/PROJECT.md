# Asiatek POS Web App

## What This Is

A responsive, offline-first web Point of Sale (POS) application for a single store in Indonesia, designed to run on desktop and tablet/mobile browsers. It supports daily cashier operations with local-first data storage, automatic synchronization to a central server when connectivity returns, and receipt printing via a local print bridge to a 58mm USB thermal printer. The system prioritizes fast transaction flow and keyboard-driven operation over visual catalog browsing.

## Core Value

Cashiers can complete end-to-end sales quickly and reliably even without internet, with automatic sync recovery when online.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] Offline-first POS transactions with local persistence and auto-sync
- [ ] Session continuity for logged-in users while offline
- [ ] POS checkout flow with keyboard shortcuts and receipt printing
- [ ] Inventory stock in/out/adjustments with offline support
- [ ] Role-based access control for Owner and Cashier

### Out of Scope

- Product image-centric POS UI - excluded to prioritize speed and table/list interaction
- Tax calculation and tax reporting - deferred from v1
- Direct bank/payment gateway integration - bank transfer is manual transaction flag only
- Multi-branch store support - deferred; v1 is single-store only

## Context

Current operations are handled with manual notes, so v1 must replace handwritten transaction and stock tracking with a dependable browser-based workflow. Hardware context is Windows PC and Android tablet clients with a USB thermal printer through a local print bridge. Business rules include two payment methods (cash and manual bank transfer), where bank transfer transactions must not increase active cash drawer totals. Inventory conflict handling should use delta-based sync, allow negative stock values, and warn cashiers before processing stock-negative sales.

## Constraints

- **Architecture**: PWA + local database with background synchronization - all core workflows must work offline for up to 7 days
- **Performance**: Item search/qty/add under 2 seconds and search-to-receipt under 15 seconds - supports cashier throughput
- **Concurrency**: 1-3 active devices in one store - sync and stock logic must tolerate concurrent edits
- **Platform**: Browser-based UI on desktop/tablet/mobile with keyboard shortcuts in browser environment - no native app dependency
- **Printer Integration**: 58mm receipt output via local print bridge to USB thermal printer - mandatory checkout completion path
- **Localization**: Indonesian language and IDR currency formatting - operational locale requirement

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-store scope for v1 | Reduce complexity and ship core workflow sooner | - Pending |
| Offline-first architecture with local DB + auto-sync | Internet instability cannot block cashier operations | - Pending |
| POS layout is list/table without product images | Faster interaction for cashier workflows | - Pending |
| Payment methods limited to cash and manual bank transfer | Keep v1 payment simple while preserving drawer integrity | - Pending |
| RBAC roles are Owner and Cashier only | Minimal role model covering immediate operational needs | - Pending |
| Inventory conflict model allows delta sync and negative stock warnings | Preserve sales continuity while surfacing stock risk | - Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-17 after initialization*
