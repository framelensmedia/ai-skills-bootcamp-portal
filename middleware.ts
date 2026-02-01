import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabaseMiddleware";

export async function middleware(request: NextRequest) {
  const res = await updateSession(request);

  // R.1. Referral Tracking
  // If ?ref=CODE is present, set a cookie for 30 days
  const { searchParams } = new URL(request.url);
  const refCode = searchParams.get("ref");

  if (refCode) {
    res.cookies.set("ref_code", refCode, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false, // Allow client reading if needed (e.g. for signup params)
      sameSite: "lax",
    });
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .*\\.(?:svg|png|jpg|jpeg|gif|webp)$ (image files)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)',
  ],
};
