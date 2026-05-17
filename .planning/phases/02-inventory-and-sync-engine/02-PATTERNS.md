# Phase 2: Inventory and Sync Engine - Pattern Map

**Mapped:** 2026-05-17
**Files analyzed:** 12
**Analogs found:** 10 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/offline/db.ts` | model | CRUD | `src/lib/offline/db.ts` | exact |
| `src/lib/offline/sync-queue.ts` | service | event-driven | `src/lib/offline/sync-queue.ts` | exact |
| `src/lib/offline/inventory-sync.ts` | service | event-driven | `src/components/auth/logout-intent-flusher.tsx` | flow-match |
| `src/app/api/sync/inventory-deltas/route.ts` | route | request-response | `src/app/api/auth/login/route.ts` | role-match |
| `src/lib/db/inventory-replay.ts` | service | batch | `src/app/api/auth/login/route.ts` | partial |
| `src/lib/inventory/mutation-event.ts` | utility | transform | `src/lib/offline/sync-queue.ts` | partial |
| `src/features/inventory/hooks/use-stock-mutation.ts` | hook | request-response | `src/hooks/use-connectivity.ts` | role-match |
| `src/features/inventory/components/negative-stock-warning.tsx` | component | event-driven | `src/components/auth/login-form.tsx` | role-match |
| `tests/inventory/mutation-queue.spec.ts` | test | CRUD | - | none |
| `tests/sync/reconnect-backoff.spec.ts` | test | event-driven | - | none |
| `tests/sync/negative-stock-warning.spec.tsx` | test | request-response | - | none |
| `tests/sync/server-replay-order.spec.ts` | test | batch | - | none |

## Pattern Assignments

### `src/lib/offline/db.ts` (model, CRUD)

**Analog:** `src/lib/offline/db.ts`

**Schema/type pattern** (lines 25-36):
```typescript
export type SyncQueueRecord = {
  id?: number;
  status: "pending" | "sent" | "acked" | "failed";
  attemptCount: number;
  nextRetryAt: number;
  lastAttemptAt?: number;
  entityType: string;
  entityId: string;
  deltaPayload: string;
  allowNegativeStock: boolean;
  createdAt: number;
};
```

**Dexie versioning/index pattern** (lines 49-64):
```typescript
constructor() {
  super("asiatek-pos-local-db");
  this.version(1).stores({ ... });
  this.version(2).stores({
    credentialCache: "username, userId, updatedAt, passwordVersion, role",
    localSessions: "key, username, lastActivityAt, mustReloginAt",
    syncQueue: "++id, status, attemptCount, nextRetryAt, entityType, entityId, createdAt",
    appMeta: "key",
  });
}
```

---

### `src/lib/offline/sync-queue.ts` (service, event-driven)

**Analog:** `src/lib/offline/sync-queue.ts`

**Imports + constants** (lines 1-5):
```typescript
import { offlineDb, type SyncQueueRecord } from "@/lib/offline/db";

const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 5 * 60 * 1_000;
```

**Backoff pattern** (lines 6-12):
```typescript
export function calculateNextRetryAt(attemptCount: number, now = Date.now()) {
  if (attemptCount <= 0) {
    return now;
  }
  const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attemptCount - 1), MAX_BACKOFF_MS);
  return now + delay;
}
```

**Queue transition pattern** (lines 33-49):
```typescript
export async function markAttempt(id: number, failed: boolean) {
  const current = await offlineDb.syncQueue.get(id);
  if (!current) return;

  const nextAttemptCount = current.attemptCount + 1;
  const status = failed ? "failed" : "sent";
  await offlineDb.syncQueue.update(id, {
    status,
    attemptCount: nextAttemptCount,
    lastAttemptAt: Date.now(),
    nextRetryAt: calculateNextRetryAt(nextAttemptCount),
  });
}

export async function markAcked(id: number) {
  await offlineDb.syncQueue.update(id, { status: "acked" });
}
```

---

### `src/lib/offline/inventory-sync.ts` (service, event-driven)

**Analog:** `src/components/auth/logout-intent-flusher.tsx`

**Online-trigger + periodic worker loop** (lines 48-62):
```typescript
const onOnline = () => {
  flushIfNeeded().catch(() => undefined);
};

flushIfNeeded().catch(() => undefined);
window.addEventListener("online", onOnline);
const timer = window.setInterval(() => {
  flushIfNeeded().catch(() => undefined);
}, 5000);

return () => {
  cancelled = true;
  window.clearInterval(timer);
  window.removeEventListener("online", onOnline);
};
```

**Non-blocking failure handling** (lines 33-38):
```typescript
if (!response.ok) {
  if (Date.now() - logoutIntentAt > INTENT_EXPIRY_MS) {
    await offlineDb.appMeta.delete("logout_intent");
  }
  return;
}
```

---

### `src/app/api/sync/inventory-deltas/route.ts` (route, request-response)

**Analog:** `src/app/api/auth/login/route.ts`

**Route handler shape + typed request body** (lines 1-14):
```typescript
import { NextRequest, NextResponse } from "next/server";

type LoginRequestBody = {
  username?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LoginRequestBody;
```

**Validation + structured JSON errors** (lines 16-21):
```typescript
if (!username || !password) {
  return NextResponse.json(
    { ok: false, message: "Username dan password wajib diisi." },
    { status: 400 },
  );
}
```

**DB write + JSON response shape** (lines 39-49, 59-67):
```typescript
await prisma.loginAudit.create({ data: { ... } });

const response = NextResponse.json({
  ok: true,
  user: {
    id: user.id,
    username: user.username,
    role: user.role,
    passwordVersion: user.passwordVersion,
  },
});
```

---

### `src/features/inventory/hooks/use-stock-mutation.ts` (hook, request-response)

**Analog:** `src/hooks/use-connectivity.ts`

**Hook state + sync callback pattern** (lines 17-29):
```typescript
export function useConnectivity() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    const reachable = await checkReachable();
    setOnline(reachable);
  }, []);
}
```

**Lifecycle cleanup pattern** (lines 31-46):
```typescript
useEffect(() => {
  const kickoff = window.setTimeout(() => {
    sync().catch(() => undefined);
  }, 0);
  window.addEventListener("online", sync);
  window.addEventListener("offline", sync);
  const timer = window.setInterval(() => {
    sync().catch(() => undefined);
  }, 5000);
  return () => {
    window.clearTimeout(kickoff);
    window.clearInterval(timer);
    window.removeEventListener("online", sync);
    window.removeEventListener("offline", sync);
  };
}, [sync]);
```

---

### `src/features/inventory/components/negative-stock-warning.tsx` (component, event-driven)

**Analog:** `src/components/auth/login-form.tsx`

**Component state + submit flow** (lines 15-21, 48-52):
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const { online } = useConnectivity();

async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setLoading(true);
  setError(null);
}
```

**Inline warning/error UI pattern** (lines 239-243):
```typescript
{error ? (
  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {error}
  </p>
) : null}
```

---

### `src/lib/db/inventory-replay.ts` (service, batch)

**Analog:** `src/app/api/auth/session/route.ts` + `src/lib/db/prisma.ts`

**Prisma import/shared client pattern** (`src/lib/db/prisma.ts` lines 1-11):
```typescript
import { PrismaClient } from "@prisma/client";

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });
```

**Session-style guard + DB fetch/error response style** (`src/app/api/auth/session/route.ts` lines 10-17, 31-33):
```typescript
if (!token) {
  return NextResponse.json({ ok: false, user: null }, { status: 401 });
}

if (!user || !user.isActive) {
  return NextResponse.json({ ok: false, user: null }, { status: 401 });
}
```

Use same explicit branch style around replay validation/idempotency checks.

## Shared Patterns

### Authentication and session guard
**Source:** `src/app/app/page.tsx` lines 13-18, 30-38
**Apply to:** Sync API routes requiring authenticated user context
```typescript
const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
const session = token ? decodeSession(token) : null;
if (!session) {
  redirect("/");
}
...
if (!user || !user.isActive || user.passwordVersion !== session.passwordVersion || user.role !== session.role) {
  redirect("/");
}
```

### Queue status machine + backoff
**Source:** `src/lib/offline/sync-queue.ts` lines 6-12, 33-44, 47-48
**Apply to:** Inventory delta queue worker transitions
```typescript
const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attemptCount - 1), MAX_BACKOFF_MS);
...
status: failed ? "failed" : "sent"
...
await offlineDb.syncQueue.update(id, { status: "acked" });
```

### Connectivity probing and scheduler lifecycle
**Source:** `src/hooks/use-connectivity.ts` lines 5-14, 31-46
**Apply to:** Background push/pull trigger and online recovery
```typescript
const response = await fetch("/api/health", { method: "GET", cache: "no-store" });
...
window.addEventListener("online", sync);
window.addEventListener("offline", sync);
const timer = window.setInterval(() => { sync().catch(() => undefined); }, 5000);
```

### Local-first write before network
**Source:** `src/components/auth/logout-button.tsx` lines 18-27
**Apply to:** Stock mutation enqueue flow
```typescript
await clearLocalSession();
await offlineDb.appMeta.put({ key: "logout_intent", value: String(Date.now()) });
if (!online) {
  window.location.assign("/");
  return;
}
const result = await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
```

### Try/catch with user-safe fallback
**Source:** `src/components/auth/login-form.tsx` lines 157-162
**Apply to:** Inventory mutation UI actions and manual retry button handling
```typescript
} catch (err) {
  const message = err instanceof Error ? err.message : "Login gagal.";
  setError(message);
} finally {
  setLoading(false);
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tests/inventory/mutation-queue.spec.ts` | test | CRUD | No existing automated test suite files in repository |
| `tests/sync/reconnect-backoff.spec.ts` | test | event-driven | No existing sync test harness pattern |
| `tests/sync/negative-stock-warning.spec.tsx` | test | request-response | No component test setup currently present |
| `tests/sync/server-replay-order.spec.ts` | test | batch | No server replay test analog currently present |

## Metadata

**Analog search scope:** `src/app/api`, `src/lib/offline`, `src/hooks`, `src/components/auth`, `src/app/app`  
**Files scanned:** 44 in `src/` (+ phase docs)  
**Pattern extraction date:** 2026-05-17
