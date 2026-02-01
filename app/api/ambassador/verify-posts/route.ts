import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        // 1. Auth
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(supabaseUrl, supabaseKey);

        const authHeader = req.headers.get("Authorization");
        if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: authErr } = await admin.auth.getUser(token);

        if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 2. Body: { links: string[] }
        const { links } = await req.json();

        // Validate 3 posts
        if (!Array.isArray(links) || links.length < 3) {
            return NextResponse.json({ error: "Please provide at least 3 post links." }, { status: 400 });
        }

        // 3. Update Ambassador Record
        // In a real app, this might go to 'pending_review'. 
        // For MVP speed, we auto-verify step -> 2 (Training Video)
        const { error: updateErr } = await admin
            .from("ambassadors")
            .update({
                social_posts_completed: links.length,
                onboarding_step: 2, // Move to Training Step
                // meta: { social_links: links } // Could store links if we added a JSON column
            })
            .eq("user_id", user.id);

        if (updateErr) throw updateErr;

        return NextResponse.json({ success: true, onboarding_step: 2 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
