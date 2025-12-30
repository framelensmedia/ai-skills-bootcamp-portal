import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Protect dashboard route(s)
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  if (!isDashboard) return NextResponse.next();

  // Supabase auth cookie (set by supabase auth helpers or your app)
  // For MVP we do a simple check: if no session cookie, redirect to /login.
  // NOTE: This is a minimal guard. We'll improve it after auth is stable.
  const hasAuthCookie =
    request.cookies.has("sb-access-token") ||
    request.cookies.has("sb:token") ||
    request.cookies.has("supabase-auth-token");

  if (!hasAuthCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
