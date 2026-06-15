# Concerns

## High Priority
- The core POS transaction flow is not present yet; current pages mostly cover login, shell, and session scaffolding.
- The service worker bypasses auth and health APIs, which is reasonable, but it also means offline auth behavior depends heavily on client-side Dexie state and browser persistence.
- Offline login currently stores a verifier derived from the entered password; this is functional, but it is a sensitive device-local secret and should be treated carefully.

## Medium Priority
- The app has two session concepts: server cookie session and Dexie local session. That is intentional, but it adds invalidation complexity.
- The login page auto-selects the last cached username when offline, which is convenient but can be surprising in shared-device scenarios.
- The offline session policy expires after idle time and on a Monday relogin schedule; these rules need product confirmation.
- The service worker caches navigations and arbitrary GETs without a visible versioning or invalidation strategy beyond the cache name.

## Operational Gaps
- No printer bridge implementation exists yet, even though receipt printing is a core project constraint.
- No sync engine implementation exists yet for queued offline mutations.
- No inventory, product, sales, or receipt domain models are present in Prisma yet.
- No explicit environment documentation was found for `SESSION_SECRET`, `DATABASE_URL`, or any printer bridge endpoint.

## Code Quality Risks
- Some client logic is still monolithic, especially the login form, which mixes UI, offline fallback, cache hydration, and persistence.
- Several utility modules rely on browser globals or platform APIs, so SSR safety needs to be preserved as the app grows.
- The repo currently has a template README, so onboarding guidance is missing.

## Overall Assessment
This is a solid foundation for an offline-first POS shell, but it is still a foundation. The next major risk is assuming the offline/auth scaffolding implies the POS transaction workflow is ready when it is not.
