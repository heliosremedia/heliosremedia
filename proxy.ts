import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/admin/auth/login") return NextResponse.next();
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    if (request.nextUrl.pathname.startsWith("/api/admin") && session.role === "VIEWER" && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return NextResponse.json({ success: false, error: "Your role does not allow content changes." }, { status: 403 });
    }
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/admin")) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
