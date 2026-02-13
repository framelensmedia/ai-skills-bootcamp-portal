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
        const { generationId, type } = body;

        if (!generationId || !type) {
            return NextResponse.json({ error: "Missing generationId or type" }, { status: 400 });
        }

        if (!["upvote", "favorite", "remix"].includes(type)) {
            return NextResponse.json({ error: "Invalid engagement type" }, { status: 400 });
        }

        // Handle favorites toggle
        if (type === "favorite") {
            const { data: existing } = await supabase
                .from("prompt_favorites")
                .select("id")
                .eq("user_id", user.id)
                .eq("generation_id", generationId)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from("prompt_favorites")
                    .delete()
                    .eq("id", existing.id);

                return NextResponse.json({ action: "unfavorited" });
            } else {
                await supabase
                    .from("prompt_favorites")
                    .insert({ user_id: user.id, generation_id: generationId });

                return NextResponse.json({ action: "favorited" });
            }
        }

        // Handle upvotes toggle
        if (type === "upvote") {
            const { data: existing } = await supabase
                .from("remix_upvotes")
                .select("id")
                .eq("user_id", user.id)
                .eq("generation_id", generationId)
                .maybeSingle();

            if (existing) {
                await supabase
                    .from("remix_upvotes")
                    .delete()
                    .eq("id", existing.id);

                return NextResponse.json({ action: "unvoted" });
            } else {
                await supabase
                    .from("remix_upvotes")
                    .insert({ user_id: user.id, generation_id: generationId });

                return NextResponse.json({ action: "upvoted" });
            }
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error("Engagement API error:", err);
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}
