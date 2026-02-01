import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get("next") ?? "/feed";

    if (code) {
        const supabase = await createSupabaseServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // Track Referral (Server side call or redirect to client wrapper)
            // Since we are in an API route, we can call the logic directly? 
            // Better to keep it consistent. We can just run the DB insert here since we have the cookie access.

            // Actually, let's keep it simple. We can trigger it via a client-side effect on the /feed?
            // OR we can do it right here.

            // Let's do a quick inline check for the cookie since we have the server client ready.
            const { cookies } = await import("next/headers");
            const cookieStore = await cookies();
            const refCode = cookieStore.get("ref_code")?.value;

            if (refCode) {
                const { data: ambassador } = await supabase.from("ambassadors").select("id").eq("referral_code", refCode).maybeSingle();
                if (ambassador) {
                    const { data: { user } } = await supabase.auth.getUser(); // refresh user
                    if (user) {
                        await supabase.from("referrals").upsert({
                            ambassador_id: ambassador.id,
                            referred_user_id: user.id,
                            status: "trial"
                        }, { onConflict: "referred_user_id" });
                    }
                }
            }

            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}
