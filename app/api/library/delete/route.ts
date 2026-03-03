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

        // 1. Verify Authentication — try getUser() first, fall back to getSession()
        const supabase = await createSupabaseServerClient();
        let userId: string | null = null;

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            userId = user.id;
        } else {
            // Fallback to session (handles some edge-cases with cookie forwarding)
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                userId = session.user.id;
            }
        }

        if (!userId) {
            console.error("Delete route: No authenticated user found");
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log(`Delete route: user=${userId} table=${table} ids=${JSON.stringify(ids)}`);

        // 2. Perform Delete with Admin Client (bypassing potential RLS issues)
        // CRITICAL: We MUST enforce user_id check manually since we are admin

        if (table === "favorites") {
            // Try deleting from prompt_favorites
            const { error: err1 } = await supabaseAdmin
                .from("prompt_favorites")
                .delete()
                .in("id", ids)
                .eq("user_id", userId);

            if (err1) console.error("prompt_favorites delete error:", err1);

            // Try deleting from video_favorites
            const { error: err2 } = await supabaseAdmin
                .from("video_favorites")
                .delete()
                .in("id", ids)
                .eq("user_id", userId);

            if (err2) console.error("video_favorites delete error:", err2);

            if (err1 && err2) {
                return NextResponse.json(
                    { error: `Failed to delete favorites: ${err1.message}` },
                    { status: 500 }
                );
            }
        } else {
            const validTables = ["prompt_generations", "video_generations"];
            const targetTable = validTables.includes(table) ? table : "prompt_generations";

            const { error, count } = await supabaseAdmin
                .from(targetTable)
                .delete({ count: "exact" })
                .in("id", ids)
                .eq("user_id", userId); // Enforce ownership

            if (error) {
                console.error(`Delete Error (${targetTable}):`, error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            console.log(`Deleted ${count ?? 0} records from ${targetTable}`);
        }

        return NextResponse.json({ success: true, count: ids.length });
    } catch (err: any) {
        console.error("API Error in /api/library/delete:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
