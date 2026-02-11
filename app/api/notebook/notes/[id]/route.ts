
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
        .from("notebook_notes")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json({ note: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createSupabaseServerClient();
    const { id } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
        .from("notebook_notes")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
