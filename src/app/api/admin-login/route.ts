import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminToken, envPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  const expected = envPassword("APP_ADMIN_PASSWORD");
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Admin password is not configured yet." },
      { status: 500 }
    );
  }
  if (typeof password !== "string" || password.trim() !== expected) {
    return NextResponse.json(
      { ok: false, error: "Wrong admin password" },
      { status: 401 }
    );
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await adminToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Shorter than the crew session: a phone left unlocked in a truck
    // shouldn't stay in admin mode for months.
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return res;
}
