import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";

const ADMIN_PATHS = ["/admin"];
const PROTECTED_PATHS = [
  "/dashboard",
  "/admin",
  "/analytics",
  "/knowledge",
  "/notifications",
  "/proposals",
  "/rfps",
  "/settings",
  "/upload",
  "/templates",
];

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

  if (!PROTECTED_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

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
    "/dashboard/:path*",
    "/admin/:path*",
    "/analytics/:path*",
    "/knowledge/:path*",
    "/notifications/:path*",
    "/proposals/:path*",
    "/rfps/:path*",
    "/settings/:path*",
    "/upload/:path*",
    "/templates/:path*",
  ],
};
