import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db/prisma";
import { applyInventoryDeltaBatch, type InventoryDeltaEvent } from "@/lib/db/inventory-replay";

type SyncDeltaBody = {
  events?: InventoryDeltaEvent[];
};
const ALLOWED_MUTATION_TYPES = new Set(["SALES_OUT", "STOCK_IN", "STOCK_ADJUSTMENT"]);

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

  const invalid = body.events.find(
    (event) =>
      !event.id_queue ||
      !event.id_produk ||
      !event.id_transaksi ||
      !ALLOWED_MUTATION_TYPES.has(event.jenis_mutasi) ||
      !Number.isFinite(event.delta_qty) ||
      !Number.isFinite(event.client_timestamp) ||
      !Number.isFinite(event.received_seq),
  );

  if (invalid) {
    return NextResponse.json({ ok: false, results: [], message: "Payload event tidak valid." }, { status: 400 });
  }

  const replay = await applyInventoryDeltaBatch(body.events);
  return NextResponse.json({
    ok: true,
    results: replay.acks,
    ordering: replay.appliedOrder,
  });
}
