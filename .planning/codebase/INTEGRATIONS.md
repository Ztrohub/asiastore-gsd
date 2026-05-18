# Integrations

## External Services And Systems

### PostgreSQL
- Prisma is configured to use PostgreSQL through `DATABASE_URL`.
- Current schema only includes `User` and `LoginAudit` models.

### Browser Storage
- Dexie stores offline state in IndexedDB.
- Local tables currently cover credential cache, local session, sync queue, and app metadata.

### PWA / Service Worker
- `src/features/pwa/service-worker-register.tsx` registers `/sw.js` in production only.
- `public/sw.js` caches shell pages and some GET responses, and bypasses auth/health API routes.

### Authentication
- `POST /api/auth/login` validates a server user and sets the signed session cookie.
- `GET /api/auth/session` validates the cookie against current user state.
- `GET` and `POST /api/auth/logout` clear the session cookie.

### Health Check
- `GET /api/health` is a simple reachability endpoint used by the client connectivity hook.

## Internal Integrations

### Offline Login
- `src/components/auth/login-form.tsx` can fall back to an offline verifier stored in Dexie.
- Offline login depends on a previous online login having cached the verifier for that device.

### Session Persistence
- Server session state and local session state are both used.
- `src/lib/session/offline-session.ts` keeps the local session aligned with idle and scheduled relogin rules.

### Logout Propagation
- `src/components/auth/logout-intent-flusher.tsx` attempts to flush an offline logout intent once connectivity returns.

### Formatting And Locale
- Currency formatting is centralized in `src/features/format/currency.ts`.
- Jakarta-localized datetime formatting is centralized in `src/features/format/datetime.ts`.

## Missing Integrations
- No printer bridge integration was found.
- No inventory sync endpoint or purchase/sales sync API was found.
- No third-party analytics, error tracking, or payment gateway integration is present.
