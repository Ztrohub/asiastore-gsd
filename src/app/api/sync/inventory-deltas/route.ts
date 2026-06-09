import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db/prisma";
import { applyInventoryDeltaBatch, type InventoryDeltaEvent } from "@/lib/db/inventory-replay";
import { isValidInventoryDeltaEvent } from "@/lib/sync/inventory-delta-validation";

type SyncDeltaBody = {
  events?: InventoryDeltaEvent[];
};
const MAX_SYNC_EVENTS_PER_BATCH = 200;

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, results: [] }, { status: 401 });
  }

  const session = decodeSession(token);
  if (!session) {
    return NextResponse.json({ ok: false, results: [] }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true, role: true, passwordVersion: true },
  });
  if (!user || !user.isActive) {
    return NextResponse.json({ ok: false, results: [] }, { status: 401 });
  }
  if (user.passwordVersion !== session.passwordVersion || user.role !== session.role) {
    return NextResponse.json({ ok: false, results: [] }, { status: 401 });
  }

  let body: SyncDeltaBody;
  try {
    body = (await request.json()) as SyncDeltaBody;
  } catch {
    return NextResponse.json(
      { ok: false, results: [], message: "JSON tidak valid." },
      { status: 400 },
    );
  }
  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ ok: false, results: [], message: "Event wajib diisi." }, { status: 400 });
  }
  if (body.events.length > MAX_SYNC_EVENTS_PER_BATCH) {
    return NextResponse.json(
      { ok: false, results: [], message: "Jumlah event melebihi batas batch." },
      { status: 413 },
    );
  }

  const invalid = body.events.find((event) => !isValidInventoryDeltaEvent(event));

  if (invalid) {
    return NextResponse.json({ ok: false, results: [], message: "Payload event tidak valid." }, { status: 400 });
  }

  const hasUserMismatch = body.events.some((event) => event.id_user && event.id_user !== session.userId);
  if (hasUserMismatch) {
    return NextResponse.json({ ok: false, results: [], message: "User event tidak sesuai sesi." }, { status: 400 });
  }
  const sanitizedEvents = body.events.map((event) => ({ ...event, id_user: session.userId }));

  const replay = await applyInventoryDeltaBatch(sanitizedEvents);
  return NextResponse.json({
    ok: true,
    results: replay.acks,
    ordering: replay.appliedOrder,
  });
}
