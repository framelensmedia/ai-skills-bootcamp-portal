import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

// Use Service Role to bypass RLS if policies are missing
// Initialized lazily inside handler to prevent build errors

export async function POST(req: Request) {
    try {
        const { ids, table = "prompt_generations" } = await req.json();

        // Initialize admin client here to avoid build-time errors
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
        }

        // 1. Verify Authentication
        const supabase = await createSupabaseServerClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Perform Delete with Admin Client (bypassing potential RLS issues)
        // CRITICAL: We MUST enforce user_id check manually since we are admin

        if (table === "favorites") {
            // Try deleting from prompt_favorites
            const { error: err1 } = await supabaseAdmin
                .from("prompt_favorites")
                .delete()
                .in("id", ids)
                .eq("user_id", user.id);

            // Try deleting from video_favorites
            const { error: err2 } = await supabaseAdmin
                .from("video_favorites")
                .delete()
                .in("id", ids)
                .eq("user_id", user.id);

            if (err1 && err2) {
                return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
            }
        } else {
            const targetTable = table === "video_generations" ? "video_generations" : (table === "prompt_generations" ? "prompt_generations" : "prompt_generations");

            const { error } = await supabaseAdmin
                .from(targetTable)
                .delete()
                .in("id", ids)
                .eq("user_id", user.id); // Enforce ownership

            if (error) {
                console.error("Delete Error:", error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
        }



        return NextResponse.json({ success: true, count: ids.length });
    } catch (err: any) {
        console.error("API Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
