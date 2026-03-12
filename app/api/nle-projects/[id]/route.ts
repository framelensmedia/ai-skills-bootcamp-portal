import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// GET /api/nle-projects/[id] — Load a specific project
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data, error } = await supabase
            .from("nle_projects")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        return NextResponse.json({ project: data });
    } catch (e: any) {
        console.error("Load NLE Project Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PUT /api/nle-projects/[id] — Update a project (auto-draft or manual save)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const updates: Record<string, any> = {};

        if (body.name !== undefined) updates.name = body.name;
        if (body.data !== undefined) updates.data = body.data;
        if (body.is_draft !== undefined) updates.is_draft = body.is_draft;

        const { data, error } = await supabase
            .from("nle_projects")
            .update(updates)
            .eq("id", id)
            .eq("user_id", user.id)
            .select("id, name, is_draft, updated_at")
            .single();

        if (error) throw new Error(error.message);

        return NextResponse.json({ project: data });
    } catch (e: any) {
        console.error("Update NLE Project Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE /api/nle-projects/[id] — Delete a project
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { error } = await supabase
            .from("nle_projects")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);

        if (error) throw new Error(error.message);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error("Delete NLE Project Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
