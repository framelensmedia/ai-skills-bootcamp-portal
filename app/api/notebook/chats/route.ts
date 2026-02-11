import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");

    let query = supabase
        .from("notebook_chats")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    if (folderId) {
        query = query.eq("folder_id", folderId);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ chats: data });
}

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const json = await request.json();
        const { title, folder_id } = json;

        const { data, error } = await supabase
            .from("notebook_chats")
            .insert({
                user_id: user.id,
                title: title || "New Strategy Session",
                folder_id: folder_id || null
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ chat: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
}
