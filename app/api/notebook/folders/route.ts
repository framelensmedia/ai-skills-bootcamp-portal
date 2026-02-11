import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("notebook_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ folders: data });
}

export async function POST(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const json = await request.json();
        const { name, parent_id } = json;

        if (!name) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("notebook_folders")
            .insert({
                user_id: user.id,
                name,
                parent_id: parent_id || null
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ folder: data });
    } catch (e) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
}

export async function DELETE(request: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    const { error } = await supabase
        .from("notebook_folders")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
