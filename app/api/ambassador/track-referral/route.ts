import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

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
        // 3. Find Ambassador
        const { data: ambassador } = await supabase
            .from("ambassadors")
            .select("id")
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

        return NextResponse.json({ success: true, ambassador_id: ambassador.id });

    } catch (e) {
        console.error("Track Referral Exception:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
