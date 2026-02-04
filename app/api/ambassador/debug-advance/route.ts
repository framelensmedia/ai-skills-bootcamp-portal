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

        // Get current step
        const { data: ambassador } = await admin
            .from("ambassadors")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (!ambassador) return NextResponse.json({ error: "Not found" }, { status: 404 });

        const nextStep = (ambassador.onboarding_step || 0) + 1;

        // Cap at 4 (Dashboard) for now, or reset to 1 if > 4?
        // Let's just increment.

        await admin
            .from("ambassadors")
            .update({ onboarding_step: nextStep })
            .eq("id", ambassador.id);

        return NextResponse.json({ success: true, onboarding_step: nextStep });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
