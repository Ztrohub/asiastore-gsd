import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { encodeSession, SESSION_COOKIE_NAME } from "@/lib/auth/server-session";
import { verifyPassword } from "@/lib/auth/password";

type LoginRequestBody = {
  username?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LoginRequestBody;
  const username = body.username?.trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { ok: false, message: "Username dan password wajib diisi." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isActive) {
    return NextResponse.json(
      { ok: false, message: "Akun tidak ditemukan atau tidak aktif." },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { ok: false, message: "Username atau password tidak valid." },
      { status: 401 },
    );
  }

  await prisma.loginAudit.create({
    data: {
      userId: user.id,
      isOffline: false,
      ipAddress:
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        null,
      userAgent: request.headers.get("user-agent"),
    },
  });

  const token = encodeSession({
    userId: user.id,
    username: user.username,
    role: user.role,
    passwordVersion: user.passwordVersion,
    issuedAt: Date.now(),
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      passwordVersion: user.passwordVersion,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 6,
  });

  return response;
}
