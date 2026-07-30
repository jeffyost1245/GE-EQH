import { NextRequest, NextResponse } from "next/server";
import {
  CREW_COOKIE,
  SESSION_COOKIE,
  envValue,
  makeSessionCookie,
} from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const foremanId = typeof body.foremanId === "string" ? body.foremanId : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name : "";

  if (!envValue("APP_PASSWORD")) {
    return NextResponse.json(
      { ok: false, error: "APP_PASSWORD is not configured" },
      { status: 500 }
    );
  }
  if (!foremanId || !password) {
    return NextResponse.json(
      { ok: false, error: "Pick a foreman and enter the password." },
      { status: 400 }
    );
  }

  // The hash never leaves the database; this only comes back true/false.
  const { data, error } = await getSupabase().rpc("verify_foreman_password", {
    p_foreman: foremanId,
    p_password: password.trim(),
    p_kind: "crew",
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "Couldn't reach the server. Try again." },
      { status: 502 }
    );
  }
  if (data !== true) {
    return NextResponse.json(
      { ok: false, error: "Wrong password for that foreman." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(SESSION_COOKIE, await makeSessionCookie(foremanId), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 60 * 60 * 24 * 90, // 90 days; crews shouldn't re-type it often
    path: "/",
  });
  // Not a credential — just tells the pages whose data to load. The
  // httpOnly cookie above is what actually grants access.
  res.cookies.set(
    CREW_COOKIE,
    encodeURIComponent(JSON.stringify({ id: foremanId, name })),
    {
      httpOnly: false,
      sameSite: "lax",
      secure,
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
    }
  );
  return res;
}
