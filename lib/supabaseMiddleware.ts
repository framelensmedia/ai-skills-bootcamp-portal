import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    response = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (request.nextUrl.pathname.startsWith("/admin") && !user) {
        // Protect admin routes
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        return NextResponse.redirect(url);
    }

    // AI Onboarding Check
    // If user is logged in, check if they have completed onboarding
    // Protected routes: /dashboard, /studio, /learn, /prompts/create, /remix, /feed
    const protectedPrefixes = ["/dashboard", "/studio", "/learn", "/prompts/create", "/remix", "/feed"];
    const isProtectedRoute = protectedPrefixes.some(prefix => request.nextUrl.pathname.startsWith(prefix));

    // Only check if user exists and is on a protected route (or root?)
    // Actually, let's enforce it on meaningful app usage.
    if (user && isProtectedRoute && !request.nextUrl.pathname.startsWith("/onboarding")) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("user_id", user.id)
            .single();

        if (profile && !profile.onboarding_completed) {
            const url = request.nextUrl.clone();
            url.pathname = "/onboarding";
            return NextResponse.redirect(url);
        }
    }

    // Add more protected routes here if needed (e.g. /studio requires auth but maybe handled client side? Best to protect server side too)
    // For now, sticking to what was likely intended.

    return response;
}
