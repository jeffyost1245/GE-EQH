import { NextResponse } from "next/server";
import { ADMIN_COOKIE, CREW_COOKIE, SESSION_COOKIE } from "@/lib/auth";

/** Sign out of this crew entirely, including any admin unlock. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const name of [SESSION_COOKIE, ADMIN_COOKIE, CREW_COOKIE]) {
    res.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return res;
}
