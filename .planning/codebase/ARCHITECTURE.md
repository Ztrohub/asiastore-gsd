# Architecture

## Topology
This is a server-rendered Next.js App Router app with client-side islands for login, connectivity awareness, theme toggling, and offline session persistence.

## Route Layout
- `/` is the login entrypoint and redirects authenticated users to `/app`.
- `/app` is the authenticated shell page.
- `/offline` is a fallback page for offline shell access.
- `/api/*` contains auth and health endpoints.

## Request Flow
1. The root page reads the signed cookie from `next/headers`.
2. If a session exists, the user is redirected to `/app`.
3. Login submits to `POST /api/auth/login` when online.
4. If the network request fails or the browser is offline, the client attempts offline login using Dexie cached material.
5. Successful login writes both the server cookie and local offline session state.

## Session Model
- The server session is a signed cookie containing user identity, role, password version, and issue time.
- The local session is stored in IndexedDB and is treated as a separate, expiry-controlled state.
- The server session is revalidated against the current `User` row on authenticated pages and session checks.

## Offline Model
- The service worker caches the app shell and static resources.
- The client connectivity hook does more than `navigator.onLine`; it also calls `/api/health`.
- Offline login is intentionally limited to credentials previously cached on the same device.

## UI Composition
- `src/app/layout.tsx` owns the global HTML shell, theme provider, and tooltip provider.
- `src/app/app/layout.tsx` owns the authenticated navigation shell.
- `src/components/ui/*` contains reusable primitives and custom wrappers around Base UI.

## Observed Direction
The architecture is currently optimized for auth, offline readiness, and shell navigation. The transaction workflow, inventory flow, and printer integration are still mostly planned rather than implemented.
