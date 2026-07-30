import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  makeAdminCookie,
  readSessionCookie,
} from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  // Unlock the crew you're signed in as — never one named by the caller.
  const foremanId = await readSessionCookie(
    req.cookies.get(SESSION_COOKIE)?.value
  );
  if (!foremanId) {
    return NextResponse.json(
      { ok: false, error: "Sign in first." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  const { data, error } = await getSupabase().rpc("verify_foreman_password", {
    p_foreman: foremanId,
    p_password: password.trim(),
    p_kind: "admin",
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Couldn't reach the server. Try again." },
      { status: 502 }
    );
  }
  if (data !== true) {
    return NextResponse.json(
      { ok: false, error: "Wrong admin password" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await makeAdminCookie(foremanId), {
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
