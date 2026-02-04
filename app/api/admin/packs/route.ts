import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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

    try {
        const body = await req.json();
        const { title, slug, summary, category, tags, templates } = body;

        if (!title || !slug || !templates || !Array.isArray(templates) || templates.length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Create Pack
        const { data: pack, error: packError } = await supabase
            .from("template_packs")
            .insert({
                title,
                slug,
                summary,
                category,
                tags: tags || [],
                is_published: false
            })
            .select("id")
            .single();

        if (packError) {
            return NextResponse.json({ error: packError.message }, { status: 500 });
        }

        // 2. Create Pack Items
        const items = templates.map((tid: string, index: number) => ({
            pack_id: pack.id,
            template_id: tid,
            sort_index: index
        }));

        const { error: itemsError } = await supabase
            .from("template_pack_items")
            .insert(items);

        if (itemsError) {
            // Rollback? Supabase doesn't support transactions via API easily without RPC.
            // We'll return error but partial success (pack created).
            return NextResponse.json({
                error: "Pack created but failed to link items: " + itemsError.message,
                pack_id: pack.id
            }, { status: 207 });
        }

        return NextResponse.json({
            success: true,
            pack_id: pack.id,
            item_count: items.length
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
