import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";
import { prisma } from "@/lib/db/prisma";
import { createPosTransactionBatch } from "@/lib/db/pos-transactions";

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

export async function POST(request: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
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
  if (!user || !user.isActive || user.role !== session.role || user.passwordVersion !== session.passwordVersion) {
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
