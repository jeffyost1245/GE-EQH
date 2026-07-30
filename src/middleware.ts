import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  adminToken,
  envPassword,
  sessionToken,
} from "@/lib/auth";

// Screens only the foreman should reach. Logging hours, the dashboard,
// and viewing entries stay open to anyone with the crew password.
const ADMIN_PATHS = ["/machines", "/crew"];

export async function middleware(req: NextRequest) {
  const password = envPassword("APP_PASSWORD");
  if (!password) {
    // Misconfigured deploy: fail closed but say why.
    return new NextResponse("APP_PASSWORD is not configured", { status: 500 });
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie !== (await sessionToken(password))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const path = req.nextUrl.pathname;
  if (ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    const adminPassword = envPassword("APP_ADMIN_PASSWORD");
    const adminCookie = req.cookies.get(ADMIN_COOKIE)?.value;
    const unlocked =
      adminPassword.length > 0 &&
      adminCookie === (await adminToken(adminPassword));
    if (!unlocked) {
      const url = new URL("/admin", req.url);
      url.searchParams.set("next", path);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Everything except the login screens, their APIs, and static assets.
  matcher: [
    "/((?!login|share|api/login|api/health|_next/static|_next/image|favicon.ico|icons/|apple-touch-icon.png|manifest.webmanifest).*)",
  ],
};
