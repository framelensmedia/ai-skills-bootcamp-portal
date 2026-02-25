import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

function authCheck(req: NextRequest) {
    const apiKey = req.headers.get("x-api-key");
    return apiKey === process.env.CLAWDBOT_API_KEY;
}

/**
 * GET /api/v1/clawdbot/taxonomy
 * Returns all existing categories and tags so the bot can avoid creating duplicates.
 */
export async function GET(req: NextRequest) {
    if (!authCheck(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all distinct categories from template_packs
    const { data: packRows, error: catErr } = await supabase
        .from("template_packs")
        .select("category")
        .not("category", "is", null);

    // Fetch all tags
    const { data: tagRows, error: tagErr } = await supabase
        .from("pack_tags")
        .select("name, slug")
        .order("name", { ascending: true });

    if (catErr) console.error("[ClawdBot] Taxonomy category fetch error:", catErr.message);
    if (tagErr) console.error("[ClawdBot] Taxonomy tag fetch error:", tagErr.message);

    const categories = Array.from(
        new Set((packRows ?? []).map((r: any) => r.category).filter(Boolean))
    ).sort();

    const tags = (tagRows ?? []).map((t: any) => t.name);

    return NextResponse.json({
        categories,
        tags,
        totals: { categories: categories.length, tags: tags.length },
    });
}
