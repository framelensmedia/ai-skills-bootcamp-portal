import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

// Ensure env vars
const SITE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(SITE_URL, SERVICE_KEY);

export async function PATCH(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, headline } = body;

    if (!id || typeof headline !== 'string') {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Verify ownership
    const { data: item } = await admin
        .from("prompt_generations")
        .select("user_id, settings")
        .eq("id", id)
        .single();

    if (!item || item.user_id !== user.id) {
        return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    // Merge settings
    const newSettings = { ...(item.settings || {}), headline };
    const { error } = await admin
        .from("prompt_generations")
        .update({ settings: newSettings })
        .eq("id", id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: item } = await admin
        .from("prompt_generations")
        .select("user_id")
        .eq("id", id)
        .single();

    if (!item || item.user_id !== user.id) {
        return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const { error } = await admin.from("prompt_generations").delete().eq("id", id);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
