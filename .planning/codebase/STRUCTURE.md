# Structure

## Root Files
- `package.json` defines scripts for dev, build, lint, and Prisma database tasks.
- `prisma/schema.prisma` defines the current database schema.
- `public/sw.js` is the service worker entry.
- `README.md` is still the default create-next-app README.

## App Router
- `src/app/layout.tsx` sets the global document shell.
- `src/app/page.tsx` handles login redirection.
- `src/app/app/layout.tsx` renders the authenticated app frame.
- `src/app/app/page.tsx` renders the dashboard-like authenticated landing page.
- `src/app/offline/page.tsx` renders the offline fallback view.
- `src/app/manifest.ts` generates the PWA manifest.

## API Routes
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/session/route.ts`
- `src/app/api/health/route.ts`

## Library Code
- `src/lib/auth/` contains server cookie handling and password hashing.
- `src/lib/crypto/` contains browser-side verifier encryption helpers.
- `src/lib/db/` contains Prisma and local seed helpers.
- `src/lib/offline/` contains Dexie database and sync queue definitions.
- `src/lib/session/` contains offline session rules and policy checks.
- `src/lib/shortcuts/` contains the POS shortcut contract.

## Features And Components
- `src/features/format/` contains IDR and Jakarta formatting helpers.
- `src/features/pwa/` contains service worker registration.
- `src/components/auth/` contains login/logout UI.
- `src/components/app/` contains shell status UI.
- `src/components/ui/` contains button, input, dialog, sheet, sidebar, tooltip, and related primitives.

## Hooks
- `src/hooks/use-connectivity.ts`
- `src/hooks/use-mobile.ts`

## Database And Seed
- `prisma/seed.ts` seeds owner and cashier users.
- `src/lib/db/seed-users.ts` exposes the default seeded accounts.

## Structural Notes
- The codebase is small and intentionally shallow right now.
- Most domain-specific folders exist, but many of them currently support only authentication, shell, or offline-session foundations.
