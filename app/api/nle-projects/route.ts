import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// GET /api/nle-projects — List user's projects
export async function GET() {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { data, error } = await supabase
            .from("nle_projects")
            .select("id, name, is_draft, created_at, updated_at")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(50);

        if (error) throw new Error(error.message);

        return NextResponse.json({ projects: data });
    } catch (e: any) {
        console.error("List NLE Projects Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST /api/nle-projects — Create a new project
export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { name, data: projectData, is_draft } = body;

        const { data, error } = await supabase
            .from("nle_projects")
            .insert({
                user_id: user.id,
                name: name || "Untitled Project",
                data: projectData || {},
                is_draft: is_draft ?? true,
            })
            .select("id, name, is_draft, created_at, updated_at")
            .single();

        if (error) throw new Error(error.message);

        return NextResponse.json({ project: data });
    } catch (e: any) {
        console.error("Create NLE Project Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
