import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authErr } = await admin.auth.getUser(token);

        if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Unlink Stripe Account
        // We do NOT delete the account from Stripe (integrity), just unlink it here so they can connect a NEW one.
        const { error: updateErr } = await admin
            .from("ambassadors")
            .update({
                stripe_account_id: null,
                onboarding_step: 2 // Revert to "Training Complete / Ready to Connect" state
            })
            .eq("user_id", user.id);

        if (updateErr) throw updateErr;

        return NextResponse.json({ success: true });

    } catch (e: any) {
        console.error("Disconnect Error:", e);
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
