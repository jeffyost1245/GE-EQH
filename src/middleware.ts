import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    // Misconfigured deploy: fail closed but say why.
    return new NextResponse("APP_PASSWORD is not configured", { status: 500 });
  }
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie === (await sessionToken(password))) {
    return NextResponse.next();
  }
  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Everything except the login screen, its API, and static assets.
  matcher: [
    "/((?!login|api/login|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
  ],
};
