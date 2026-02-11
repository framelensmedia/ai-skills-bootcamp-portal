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
    const pinnedinfo = searchParams.get("pinned");

    let query = supabase
        .from("notebook_notes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

    if (folderId) {
        query = query.eq("folder_id", folderId);
    }

    if (pinnedinfo === 'true') {
        query = query.eq("is_pinned", true);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ notes: data });
}

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const json = await request.json();
        const { id, title, content, folder_id, is_pinned } = json;

        if (id) {
            // Update existing
            const { data, error } = await supabase
                .from("notebook_notes")
                .update({
                    title,
                    content,
                    folder_id,
                    is_pinned,
                    updated_at: new Date().toISOString()
                })
                .eq("id", id)
                .eq("user_id", user.id)
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ note: data });
        } else {
            // Create new
            const { data, error } = await supabase
                .from("notebook_notes")
                .insert({
                    user_id: user.id,
                    title: title || "Untitled Note",
                    content: content || "",
                    folder_id: folder_id || null,
                    is_pinned: is_pinned || false
                })
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ note: data });
        }

    } catch (e: any) {
        return NextResponse.json({ error: e.message || "Invalid request" }, { status: 400 });
    }
}
