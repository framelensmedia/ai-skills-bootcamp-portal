import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { intent } = body;

        if (!intent || !['learn', 'create', 'both'].includes(intent)) {
            return NextResponse.json({ error: "Invalid intent. Must be 'learn', 'create', or 'both'." }, { status: 400 });
        }

        // Update profile with intent and mark onboarding as completed
        const { error } = await supabase
            .from("profiles")
            .update({
                intent,
                onboarding_completed: true
            })
            .eq("user_id", user.id);

        if (error) {
            console.error("Intent update error:", error);
            return NextResponse.json({ error: "Failed to set intent." }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Onboarding completed." });

    } catch (err: any) {
        console.error("API Error:", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
