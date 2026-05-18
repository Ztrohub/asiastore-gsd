# Conventions

## Language And Types
- TypeScript is used throughout.
- Types are explicit for auth payloads, offline records, and formatter inputs.
- String literal unions are used for role and status values instead of enums in some client-side modules.

## Pathing
- Absolute imports use the `@/` alias.
- Domain code is grouped by concern rather than by layer only.

## UI Conventions
- Components are functional and mostly split into server and client files at the route boundary.
- Styling is done with Tailwind utility classes directly in the component markup.
- Shared primitives under `src/components/ui/` wrap Base UI components and use `data-slot` markers.
- Small visual states are handled with badges, borders, muted text, and rounded cards.

## Auth And Session Conventions
- Server auth uses signed cookies with explicit validation against the database.
- Local offline session state is kept separate from the server cookie.
- Offline login is constrained to the last cached online identity on the device.
- Logout writes an offline intent flag so the local and server states can converge later.

## Locale Conventions
- UI text is in Indonesian.
- Currency formatting is IDR.
- Jakarta time is used for session timestamps shown in the UI.

## Styling Conventions
- The theme palette is custom, not the default Tailwind palette.
- Light and dark themes are both defined in `src/app/globals.css`.

## Code Hygiene
- `src/lib/db/prisma.ts` uses the standard global client singleton pattern for development.
- Client hooks keep polling intervals and event listeners cleaned up on unmount.

## Gaps In Conventions
- There is no established testing convention yet.
- No lint or formatting wrapper beyond ESLint and Prettier-like class style consistency was found.
