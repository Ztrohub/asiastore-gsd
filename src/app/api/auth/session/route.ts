import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { decodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  const session = decodeSession(token);
  if (!session) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
      passwordVersion: true,
      lastCredentialChangeAt: true,
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ ok: false, user: null }, { status: 401 });
  }

  if (user.passwordVersion !== session.passwordVersion || user.role !== session.role) {
    return NextResponse.json(
      {
        ok: false,
        invalidated: true,
        reason: "credentials_changed",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, user });
}
