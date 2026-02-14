
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { sendGHLWebhook } from "@/lib/ghl";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { email, firstName, lastName, source, tags } = body;

        // Verify email matches authenticated user to prevent spoofing
        if (email !== user.email) {
            return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
        }

        await sendGHLWebhook({
            email,
            firstName,
            lastName,
            source: source || "AI Skills Studio (Email Signup)",
            tags: tags || ["ai-skills-new-user"],
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in GHL webhook proxy:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
