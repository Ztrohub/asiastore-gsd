# Walking Skeleton - Asiatek POS Web App

**Phase:** 1
**Generated:** 2026-05-17

## Capability Proven End-to-End

A seeded owner or cashier can sign in online, land in a responsive authenticated shell, and establish the local cache/session foundations that later phases will extend for offline continuation.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16 App Router | Gives the project one codebase for browser UI, route handlers, manifests, and PWA plumbing while still supporting a client-heavy offline shell. |
| Data layer | Prisma ORM + PostgreSQL for server truth, Dexie + IndexedDB for local-first cache | PostgreSQL fits future concurrent sync requirements; Dexie gives an offline-first browser store with reactive reads and explicit schema versioning. |
| Auth | Route-handler login with server-issued session cookie plus encrypted local credential envelope for offline re-login | Matches phase decisions: first login is online, returning users can re-login offline, and server-side password/role changes can invalidate the local session on reconnect. |
| Deployment target | Local full-stack run command first (`docker compose up -d db && pnpm prisma migrate dev && pnpm prisma db seed && pnpm dev`) | Satisfies Walking Skeleton requirements without forcing a hosting provider decision before the product foundation is proven. |
| Directory layout | `src/app/*` for routes and manifests, `src/features/*` for feature modules, `src/lib/*` for shared infra | Keeps plan ownership boundaries clean for later parallel phase execution. |

## Stack Touched in Phase 1

- [x] Project scaffold (Next.js, TypeScript, Tailwind, ESLint, shadcn/ui baseline)
- [x] Routing - real auth and authenticated shell routes
- [x] Database - real PostgreSQL read and write through Prisma
- [x] UI - login form and authenticated shell interaction
- [x] Deployment - documented local full-stack run command

## Out of Scope (Deferred to Later Slices)

- Inventory CRUD, stock deltas, and negative-stock warnings
- POS cart, checkout, discounts, and receipt printing
- User management CRUD beyond seeded owner/cashier records
- Central sync conflict resolution beyond the baseline queue contract
- Production hosting and managed database selection

## Subsequent Slice Plan

- Phase 2: Extend the server/data contracts with inventory operations and robust sync semantics.
- Phase 3: Add the high-speed POS interaction model and receipt-printing bridge.
- Phase 4: Build day-start/day-end workflows and transaction history on top of the same auth and offline shell.
- Phase 5: Replace seeded-user assumptions with owner-managed cashier lifecycle and route/action RBAC.
