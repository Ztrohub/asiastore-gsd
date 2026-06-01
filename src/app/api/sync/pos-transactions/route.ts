import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db/prisma";
import {
  createPosTransactionBatch,
  getPosTransactionSyncTime,
  listPosTransactionsForSync,
} from "@/lib/db/pos-transactions";
import {
  parsePosTransactionSyncCursor,
  serializePosTransactionSyncCursor,
} from "@/lib/sync/pos-transaction-sync-cursor";

type Body = {
  transactions?: Array<{
    id_transaksi: string;
    short_id: string;
    kasir_user_id: string;
    kasir_username: string;
    payment_method: "cash" | "bank_transfer";
    subtotal_amount: number;
    item_discount: number;
    order_discount: number;
    total_amount: number;
    amount_received?: number;
    change_amount?: number;
    counts_for_cash: boolean;
    note?: string;
    client_timestamp: number;
    lines: Array<{
      id_produk: string;
      nama_produk: string;
      unit_price: number;
      qty: number;
      unit_label?: string;
      line_discount: number;
      line_total: number;
    }>;
  }>;
};

async function authorizeSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }
  const session = decodeSession(token);
  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true, role: true, passwordVersion: true },
  });
  if (!user || !user.isActive || user.role !== session.role || user.passwordVersion !== session.passwordVersion) {
    return null;
  }

  return session;
}

function parseCursor(request: NextRequest) {
  const rawCursor = request.nextUrl.searchParams.get("cursor");
  if (rawCursor === null) {
    return undefined;
  }
  return parsePosTransactionSyncCursor(rawCursor) ? rawCursor : null;
}

export async function GET(request: NextRequest) {
  const session = await authorizeSession();
  if (!session) {
    return NextResponse.json({ ok: false, transactions: [] }, { status: 401 });
  }

  const cursor = parseCursor(request);
  if (cursor === null) {
    return NextResponse.json(
      { ok: false, message: "Parameter cursor tidak valid.", transactions: [] },
      { status: 400 },
    );
  }

  const transactions = await listPosTransactionsForSync({ cursor });
  const nextCursor =
    transactions.length > 0
      ? serializePosTransactionSyncCursor({
          timestamp: getPosTransactionSyncTime(transactions[transactions.length - 1]),
          id_transaksi: transactions[transactions.length - 1].id_transaksi,
        })
      : (cursor ?? "0");

  return NextResponse.json({
    ok: true,
    cursor: nextCursor,
    transactions: transactions.map((transaction) => ({
      ...transaction,
      client_timestamp: transaction.client_timestamp.toISOString(),
      createdAt: transaction.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await authorizeSession();
  if (!session) {
    return NextResponse.json({ ok: false, results: [] }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, results: [], message: "JSON tidak valid." }, { status: 400 });
  }

  if (!Array.isArray(body.transactions) || body.transactions.length === 0) {
    return NextResponse.json({ ok: false, results: [], message: "Transactions wajib diisi." }, { status: 400 });
  }

  const results = await createPosTransactionBatch(body.transactions);
  return NextResponse.json({ ok: true, results });
}
