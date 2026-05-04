import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

const PUBLIC_PATHS = ["/login", "/signup", "/_next", "/favicon.ico", "/api"];
const ADMIN_PATHS = ["/admin"];

function isPublic(pathname: string): boolean {
  // Always bypass middleware for static assets (e.g. .css/.js/.png/.svg/.woff2)
  if (/\.[^/]+$/.test(pathname)) return true;
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

function isTokenValid(token: string): boolean {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function getRoleFromToken(token: string): string | null {
  try {
    const decoded = jwtDecode<{ role?: string; sub?: string }>(token);
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Check for JWT in cookie (set at login)
  const token = request.cookies.get("entropy_token")?.value;

  if (!token || !isTokenValid(token)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin route protection
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const role = getRoleFromToken(token);
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|_next/data|favicon.ico|.*\\..*).*)",
  ],
};
