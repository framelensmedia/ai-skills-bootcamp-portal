
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { promptId, generationId } = await req.json();

    if (!promptId && !generationId) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    // Insert favorite
    // We assume prompt_favorites table exists.
    const row = {
        user_id: user.id,
        prompt_id: promptId || null,
        generation_id: generationId || null,
    };

    const { error } = await supabase.from("prompt_favorites").insert(row);

    if (error) {
        // Check if duplicate, maybe treat as success or ignore
        if (error.code === "23505") {
            // Unique violation
            return NextResponse.json({ success: true, alreadyExists: true });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const promptId = searchParams.get("promptId");
    const generationId = searchParams.get("generationId");

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let q = supabase.from("prompt_favorites").delete().eq("user_id", user.id);

    if (promptId) {
        q = q.eq("prompt_id", promptId);
    } else if (generationId) {
        q = q.eq("generation_id", generationId);
    } else {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
