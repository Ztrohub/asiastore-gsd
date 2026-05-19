import { NextRequest, NextResponse } from "next/server";

type PrintBody = {
  receiptText?: string;
  bridgeUrl?: string;
};

export async function POST(request: NextRequest) {
  let body: PrintBody;
  try {
    body = (await request.json()) as PrintBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Payload tidak valid." }, { status: 400 });
  }

  const receiptText = body.receiptText?.trim() ?? "";
  if (!receiptText) {
    return NextResponse.json({ ok: false, message: "Receipt kosong." }, { status: 400 });
  }

  const bridgeUrl =
    body.bridgeUrl?.trim() || process.env.PRINT_BRIDGE_URL?.trim();
  if (!bridgeUrl) {
    return NextResponse.json({
      ok: true,
      fallbackPreview: true,
      message: "PRINT_BRIDGE_URL belum diatur. Fallback ke browser print preview.",
    });
  }

  try {
    const bridgeResponse = await fetch(bridgeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptText }),
      cache: "no-store",
    });

    if (!bridgeResponse.ok) {
      return NextResponse.json(
        { ok: false, message: "Print bridge menolak request." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, fallbackPreview: false });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Tidak dapat terhubung ke print bridge." },
      { status: 502 },
    );
  }
}
