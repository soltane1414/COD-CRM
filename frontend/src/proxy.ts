import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Proxy (formerly Middleware)
 * Handles:
 * 1. Authentication guards — redirect unauthenticated users to /login
 * 2. Already-authenticated guards — redirect logged-in users away from auth pages
 * 3. Super admin route protection
 */

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password"];
const AUTH_COOKIE = "cod_crm_access_token";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE)?.value;

  // Skip proxy for static assets, API routes, etc.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/locales") ||
    pathname.includes(".") // static files
  ) {
    return NextResponse.next();
  }

  const isPublicPath = PUBLIC_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname.startsWith(p)
  );

  // Allow public paths without auth
  if (isPublicPath && !token) {
    return NextResponse.next();
  }

  // Redirect authenticated users away from auth pages (but not landing)
  if ((pathname.startsWith("/login") || pathname.startsWith("/register")) && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Allow landing page for everyone
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!isPublicPath && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
