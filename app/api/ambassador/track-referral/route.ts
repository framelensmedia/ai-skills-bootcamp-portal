import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { sendAmbassadorWebhook } from "@/lib/ghl";

export async function POST(request: Request) {
    // 1. Check for cookie
    const cookieStore = await cookies();
    const refCode = cookieStore.get("ref_code")?.value;

    if (!refCode) {
        return NextResponse.json({ message: "No referral code found" });
    }

    // 2. Auth user
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // 3. Find Ambassador (need to get user_id to fetch email)
        // Usually ambassadors table has user_id or similar.
        // Assuming ambassadors table structure: id, user_id, referral_code
        // If it doesn't have user_id and relies on something else, we might need to adjust.
        // But assuming standard relation:
        const { data: ambassador } = await supabase
            .from("ambassadors")
            .select("id, user_id")
            .eq("referral_code", refCode)
            .single();

        if (!ambassador) {
            return NextResponse.json({ message: "Invalid referral code" });
        }

        // 4. Create Referral Record (Trial/Free)
        // using upsert to prevent unique constraint error if multiple calls
        const { error } = await supabase
            .from("referrals")
            .upsert({
                ambassador_id: ambassador.id,
                referred_user_id: user.id,
                status: "trial", // Free/Trial status
                created_at: new Date().toISOString()
            }, { onConflict: "referred_user_id" });

        if (error) {
            console.error("Referral Error:", error);
            // Don't fail the request, just log it
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 5. Notify Ambassador (Async)
        // Need to fetch ambassador email. Since current user is the referred one, they can't see ambassador's email.
        // Use Service Role to fetch it.
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const adminSupabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            // Fetch ambassador email from auth.users or profiles
            // Try profiles first (if exists) or auth.admin
            // Actually, querying profiles with service role is cleaner than auth admin if possible, 
            // but auth admin is guaranteed to have email.

            let ambassadorEmail = "";
            if (ambassador.user_id) {
                const { data: userData, error: userError } = await adminSupabase.auth.admin.getUserById(ambassador.user_id);
                if (!userError && userData.user) {
                    ambassadorEmail = userData.user.email || "";
                }
            }

            if (ambassadorEmail) {
                // Fire webhook
                await sendAmbassadorWebhook({
                    type: "referral_success",
                    ambassador_id: ambassador.id,
                    ambassador_email: ambassadorEmail,
                    referred_user_email: user.email || "",
                    referred_user_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "New User"
                });
            }
        }

        return NextResponse.json({ success: true, ambassador_id: ambassador.id });

    } catch (e) {
        console.error("Track Referral Exception:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
