import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "APP_PASSWORD is not configured" },
      { status: 500 }
    );
  }
  if (typeof password !== "string" || password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Wrong password" },
      { status: 401 }
    );
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 90, // 90 days; crews shouldn't re-type it often
    path: "/",
  });
  return res;
}
