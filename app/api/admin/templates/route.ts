import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const supabase = await createSupabaseServerClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (!profile || !["staff", "admin", "super_admin", "editor"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden - Staff only" }, { status: 403 });
    }

    // Parse search params
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "";

    let dbQuery = supabase
        .from("prompts")
        .select("id, title, slug, category, tags, preview_image_storage_path, created_at, status")
        .order("created_at", { ascending: false })
        .limit(100);

    if (query) {
        dbQuery = dbQuery.ilike("title", `%${query}%`);
    }

    const { data, error } = await dbQuery;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data });
}
