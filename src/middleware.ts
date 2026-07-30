import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  envValue,
  readAdminCookie,
  readSessionCookie,
} from "@/lib/auth";

// Screens only a foreman should reach. Logging hours, the dashboard, and
// viewing entries stay open to anyone with that crew's password.
const ADMIN_PATHS = ["/machines", "/crew"];

export async function middleware(req: NextRequest) {
  if (!envValue("APP_PASSWORD")) {
    // Misconfigured deploy: fail closed but say why. APP_PASSWORD is the
    // cookie signing secret now, not a password anyone types.
    return new NextResponse("APP_PASSWORD is not configured", { status: 500 });
  }

  const foremanId = await readSessionCookie(
    req.cookies.get(SESSION_COOKIE)?.value
  );
  if (!foremanId) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const path = req.nextUrl.pathname;
  if (ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    const adminFor = await readAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value);
    // The admin cookie must belong to the crew that's signed in, so
    // unlocking one crew never unlocks another.
    if (adminFor !== foremanId) {
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
    "/((?!login|share|api/login|api/logout|api/foremen|api/health|_next/static|_next/image|favicon.ico|icons/|apple-touch-icon.png|manifest.webmanifest).*)",
  ],
};
