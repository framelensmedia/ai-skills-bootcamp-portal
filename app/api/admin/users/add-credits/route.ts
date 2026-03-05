import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
    try {
        const supabaseUser = await createSupabaseServerClient();
        const { data: userData } = await supabaseUser.auth.getUser();

        if (!userData?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const myId = userData.user.id;

        // init admin client to bypass RLS and perform update
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Verify caller is admin/super_admin
        const { data: meProfile } = await supabaseAdmin
            .from("profiles")
            .select("role")
            .eq("user_id", myId)
            .single();

        const allowed = ["admin", "super_admin"];
        if (!meProfile || !allowed.includes(meProfile.role)) {
            return NextResponse.json(
                { error: "Forbidden. Must be admin or super_admin." },
                { status: 403 }
            );
        }

        const { targetUserId, amount } = await req.json();

        if (!targetUserId || typeof amount !== "number" || isNaN(amount) || amount <= 0) {
            return NextResponse.json(
                { error: "Invalid request body (targetUserId, amount required, amount > 0)" },
                { status: 400 }
            );
        }

        // Get target user's current credits
        const { data: targetProfile, error: targetErr } = await supabaseAdmin
            .from("profiles")
            .select("credits")
            .eq("user_id", targetUserId)
            .single();

        if (targetErr || !targetProfile) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        const currentCredits = targetProfile.credits ?? 0;
        const newCredits = currentCredits + amount;

        // Update credits
        const { error: updateErr } = await supabaseAdmin
            .from("profiles")
            .update({
                credits: newCredits,
                updated_at: new Date().toISOString()
            })
            .eq("user_id", targetUserId);

        if (updateErr) {
            throw updateErr;
        }

        return NextResponse.json({
            success: true,
            newTotal: newCredits
        });
    } catch (err: any) {
        console.error("Manual add credits error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
