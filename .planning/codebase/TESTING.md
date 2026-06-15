# Testing

## Current Tooling
- `eslint` is the only explicit verification script in `package.json`.
- `playwright` is installed, but no test files or runner scripts were found yet.
- Prisma database lifecycle commands are present for local development.

## What Is Already Observable
- Auth logic is split between server routes and client offline fallback code, which is testable at both layers.
- The service worker behavior is centralized in `public/sw.js`.
- Session policy logic is centralized in `src/lib/session/policy.ts`.

## Apparent Testing Gaps
- No unit tests were found for password hashing, session encoding/decoding, or offline session expiry policy.
- No integration tests were found for login, logout, or session invalidation.
- No E2E tests were found for the offline fallback path.
- No tests were found for the service worker navigation fallback.

## Suggested Coverage Areas
- Password verification and session signing
- Offline session expiration and scheduled relogin rules
- Login route success and failure cases
- Logout intent flush behavior
- Connectivity hook behavior against a healthy or unreachable `/api/health`
- Service worker caching and offline navigation fallback

## Risk Note
Without automated tests, the current auth/offline code is vulnerable to regressions in browser behavior, cookie handling, and offline cache interactions.
