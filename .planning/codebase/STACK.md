# Stack

## Summary
The repository is a Next.js App Router application written in TypeScript and React 19. It uses a local-first client storage layer for offline session data and a PostgreSQL-backed Prisma layer for server state.

## Runtime And Framework
- `next@16.2.6`
- `react@19.2.4`
- `react-dom@19.2.4`
- App Router structure under `src/app/`
- Route handlers under `src/app/api/`

## State And Data
- `prisma@6.9.0` with a PostgreSQL datasource
- `dexie@4.4.2` for IndexedDB-backed offline storage
- `@prisma/client` used from `src/lib/db/prisma.ts`

## UI And Styling
- Tailwind CSS 4 via `tailwindcss` and `@tailwindcss/postcss`
- `next-themes` for light/dark theme switching
- `@base-ui/react` primitives for buttons, inputs, dialogs, sheets, tooltips
- `lucide-react` for icons
- `sonner` is installed, but no visible usage was found in the current app shell

## Security And Auth
- Session cookies are signed in `src/lib/auth/server-session.ts`
- Password hashing uses Node `crypto.scrypt` in `src/lib/auth/password.ts`
- Offline credential verifier encryption uses Web Crypto in `src/lib/crypto/device-crypto.ts`

## PWA And Offline
- Service worker registration lives in `src/features/pwa/service-worker-register.tsx`
- Offline shell caching is implemented in `public/sw.js`
- The app manifest is generated from `src/app/manifest.ts`

## Tooling
- ESLint 9
- TypeScript 5
- Playwright is present as a dependency, but no test suite was found yet
- Prisma seed support via `tsx prisma/seed.ts`

## Notable Absences
- No separate state management library
- No backend queue processor or sync worker is implemented yet
- No printer bridge client code was found yet
