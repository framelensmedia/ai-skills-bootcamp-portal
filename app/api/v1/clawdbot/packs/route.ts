import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

/**
 * GET /api/v1/clawdbot/packs
 * Returns all template packs with their template IDs for ClawdBot to reference.
 *
 * Optional query params:
 *   ?include_templates=true  — include template IDs and titles per pack (default: true)
 *   ?published_only=true     — only return published packs (default: false)
 */
export async function GET(req: NextRequest) {
    const apiKey = req.headers.get("x-api-key");
    if (apiKey !== process.env.CLAWDBOT_API_KEY) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const includeTemplates = searchParams.get("include_templates") !== "false"; // default true
    const publishedOnly = searchParams.get("published_only") === "true";

    // 1. Fetch packs
    let query = supabase
        .from("template_packs")
        .select("id, title, slug, category, is_published, created_at")
        .order("created_at", { ascending: false });

    if (publishedOnly) query = query.eq("is_published", true);

    const { data: packs, error: packsErr } = await query;
    if (packsErr) {
        return NextResponse.json({ error: packsErr.message }, { status: 500 });
    }

    // 2. Optionally fetch templates grouped by pack
    let templateMap: Record<string, { id: string; title: string; slug: string }[]> = {};

    if (includeTemplates && packs && packs.length > 0) {
        const packIds = packs.map((p: any) => p.id);

        const { data: templates, error: templatesErr } = await supabase
            .from("prompts")
            .select("id, title, slug, template_pack_id")
            .in("template_pack_id", packIds)
            .order("created_at", { ascending: true });

        if (!templatesErr && templates) {
            for (const t of templates as any[]) {
                if (!templateMap[t.template_pack_id]) templateMap[t.template_pack_id] = [];
                templateMap[t.template_pack_id].push({ id: t.id, title: t.title, slug: t.slug });
            }
        }
    }

    // 3. Build response
    const result = (packs ?? []).map((p: any) => ({
        pack_id: p.id,
        title: p.title,
        slug: p.slug,
        category: p.category,
        is_published: p.is_published,
        created_at: p.created_at,
        ...(includeTemplates && { templates: templateMap[p.id] ?? [] }),
    }));

    return NextResponse.json({
        total: result.length,
        packs: result,
    });
}
