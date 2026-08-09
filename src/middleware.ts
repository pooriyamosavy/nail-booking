import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/register"];
const PUBLIC_API_PREFIXES = ["/api/auth/login", "/api/auth/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/logo") ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isPublicApi = PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (isPublicApi) {
    return NextResponse.next();
  }

  if (isPublicPage) {
    // Do not trust JWT alone — deleted users keep a cookie until /api/auth/me clears it.
    // Login/register pages verify via SessionGuard / client me check.
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "ورود لازم است" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname.startsWith("/api/") && pathname.includes("/admin")) {
    // handled per-route
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
