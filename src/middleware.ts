import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  envValue,
  readAdminCookie,
  readSession,
} from "@/lib/auth";

// Screens only a foreman should reach, guarded by the second password.
const ADMIN_PATHS = ["/machines", "/crew"];

// Where a superintendent may go. They oversee every crew but only change
// maintenance, so the crew-scoped screens — logging hours, editing
// entries, managing machines and people — are closed to them.
const SUPERINTENDENT_PATHS = ["/overview", "/maintenance", "/sheets"];

export async function middleware(req: NextRequest) {
  if (!envValue("APP_PASSWORD")) {
    // Misconfigured deploy: fail closed but say why. APP_PASSWORD is the
    // cookie signing secret now, not a password anyone types.
    return new NextResponse("APP_PASSWORD is not configured", { status: 500 });
  }

  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const path = req.nextUrl.pathname;

  if (session.role === "superintendent") {
    const allowed = SUPERINTENDENT_PATHS.some(
      (p) => path === p || path.startsWith(`${p}/`)
    );
    // Their home is the overview; anything crew-scoped goes there too
    // rather than showing a screen that would be empty or misleading.
    return allowed
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/overview", req.url));
  }

  // Foremen have no business on the cross-crew screens.
  if (
    SUPERINTENDENT_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
  ) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    const adminFor = await readAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value);
    // The admin cookie must belong to the crew that's signed in, so
    // unlocking one crew's management screens never unlocks another's.
    if (adminFor !== session.foremanId) {
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
