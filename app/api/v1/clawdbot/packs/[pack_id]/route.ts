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
 * Upserts a tag by name and returns its ID.
 * Creates the tag if it doesn't exist, returns existing ID if it does.
 */
async function upsertTag(name: string): Promise<string | null> {
    const normalized = name.trim();
    if (!normalized) return null;

    // Try to find existing
    const { data: existing } = await supabase
        .from("pack_tags")
        .select("id")
        .eq("name", normalized)
        .maybeSingle();

    if (existing?.id) return existing.id;

    // Create new
    const slug = normalized.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const { data: created, error } = await supabase
        .from("pack_tags")
        .insert({ name: normalized, slug })
        .select("id")
        .single();

    if (error) {
        console.error(`[ClawdBot] Failed to upsert tag "${normalized}":`, error.message);
        return null;
    }
    return created.id;
}

/**
 * Maps an array of tag names to a pack.
 * Replaces any existing tag mappings for this pack.
 */
async function applyTagsToPack(packId: string, tagNames: string[]) {
    // 1. Upsert all tags and get their IDs
    const tagIds = (await Promise.all(tagNames.map(upsertTag))).filter(Boolean) as string[];

    // 2. Remove existing mappings for this pack
    await supabase.from("pack_tag_map").delete().eq("pack_id", packId);

    // 3. Insert new mappings
    if (tagIds.length > 0) {
        const mappings = tagIds.map(tag_id => ({ pack_id: packId, tag_id }));
        const { error } = await supabase.from("pack_tag_map").insert(mappings);
        if (error) console.error(`[ClawdBot] Failed to map tags to pack ${packId}:`, error.message);
    }

    return tagIds;
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ pack_id: string }> }
) {
    if (!authCheck(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pack_id } = await params;

    if (!pack_id) {
        return NextResponse.json({ error: "pack_id is required" }, { status: 400 });
    }

    const body = await req.json();
    const { category, tags, difficulty, is_published, seo_title, seo_description } = body;

    // 1. Verify pack exists
    const { data: pack, error: packErr } = await supabase
        .from("template_packs")
        .select("id, title, category")
        .eq("id", pack_id)
        .maybeSingle();

    if (packErr || !pack) {
        return NextResponse.json({ error: "Pack not found" }, { status: 404 });
    }

    // 2. Build pack update payload (only include provided fields)
    const updates: Record<string, any> = {};
    if (category !== undefined) updates.category = category;
    if (difficulty !== undefined) updates.difficulty = difficulty;
    if (is_published !== undefined) updates.is_published = is_published;
    if (seo_title !== undefined) updates.seo_title = seo_title;
    if (seo_description !== undefined) updates.seo_description = seo_description;

    // 3. Update pack record if there are scalar changes
    if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
            .from("template_packs")
            .update(updates)
            .eq("id", pack_id);

        if (updateErr) {
            return NextResponse.json({ error: `Pack update failed: ${updateErr.message}` }, { status: 500 });
        }
    }

    // 4. Handle tags (upsert + map)
    let appliedTags: string[] = [];
    if (Array.isArray(tags)) {
        await applyTagsToPack(pack_id, tags);
        appliedTags = tags;
    }

    console.log(`[ClawdBot] Updated pack ${pack_id} (${pack.title}): category=${category}, tags=${appliedTags.join(", ")}`);

    return NextResponse.json({
        success: true,
        pack_id,
        updated: { ...updates, tags: appliedTags },
    });
}
