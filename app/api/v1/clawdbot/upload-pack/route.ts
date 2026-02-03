import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin Client (Service Role)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);

export async function POST(req: NextRequest) {
    try {
        // 1. Auth Check
        const apiKey = req.headers.get("x-api-key");
        const validKey = process.env.CLAWDBOT_API_KEY;

        if (!validKey || apiKey !== validKey) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { pack, templates, author_id } = body;

        if (!pack || !pack.name || !templates || !Array.isArray(templates)) {
            return NextResponse.json({ error: "Invalid payload: pack.name and templates array required." }, { status: 400 });
        }

        if (!author_id) {
            // Try to find a fallback? No, let's require it for now to be safe, or default to a known ID if user provided one in Env.
            // return NextResponse.json({ error: "author_id required in payload." }, { status: 400 });
            // Actually, let's log and try to proceed if system allows, but it likely won't.
            console.warn("[Clawdbot] Warning: No author_id provided. Operations might fail if author_id is required.");
        }

        console.log(`[Clawdbot] Processing Pack: ${pack.name} with ${templates.length} templates.`);

        // 2. Upload Pack Thumbnail (if URL provided)
        let packThumbnailPath = null;
        if (pack.thumbnail_url) {
            packThumbnailPath = await uploadImageFromUrl(pack.thumbnail_url, `packs/${sanitize(pack.name)}-thumb-${Date.now()}.png`);
        }

        // 3. Create Pack Record
        const slug = pack.slug || `${sanitize(pack.name)}-${Date.now()}`;

        // SCHEMA FIX: Use 'title' instead of 'pack_name'.
        // Also Populate legacy 'pack_name' and 'pack_id' if they exist to satisfy constraints.
        const packPayload: any = {
            title: pack.name, // Correct Column
            pack_name: pack.name, // Legacy Column (just in case)
            slug: slug,
            pack_id: slug, // Legacy Column (sometimes used as slug or ID, try slug)
            access_level: pack.access_level || "free",
            is_published: pack.is_published !== undefined ? pack.is_published : false,
            category: pack.category || "General",
            thumbnail_url: packThumbnailPath ? getPublicUrl(packThumbnailPath) : null,
        };

        const { data: packRecord, error: packError } = await supabase
            .from("template_packs")
            .insert(packPayload)
            .select()
            .single();

        if (packError) throw new Error(`Pack creation failed: ${packError.message}`);

        console.log(`[Clawdbot] Created Pack ID: ${packRecord.id}`);

        // 4. Process Templates
        const results = [];
        for (const t of templates) {
            try {
                let previewPath = null;
                if (t.image_url) {
                    previewPath = await uploadImageFromUrl(t.image_url, `prompts/${sanitize(t.title)}-${Date.now()}.png`);
                }

                const promptPayload: any = {
                    template_pack_id: packRecord.id,
                    title: t.title,
                    slug: `${sanitize(t.title)}-${Date.now()}`,
                    prompt_text: t.prompt_text || "",
                    prompt: t.prompt_text || "",
                    access_level: t.access_level || pack.access_level || "free",
                    status: "published",
                    media_type: "image",
                    preview_image_storage_path: previewPath,
                    featured_image_url: previewPath ? getPublicUrl(previewPath) : null,
                };

                if (author_id) {
                    promptPayload.author_id = author_id;
                }

                const { data: promptRecord, error: promptError } = await supabase
                    .from("prompts")
                    .insert(promptPayload)
                    .select("id")
                    .single();

                if (promptError) throw promptError;
                results.push({ title: t.title, status: "success", id: promptRecord.id });

            } catch (err: any) {
                console.error(`[Clawdbot] Template Error (${t.title}):`, err);
                results.push({ title: t.title, status: "error", error: err.message });
            }
        }

        return NextResponse.json({
            success: true,
            pack_id: packRecord.id,
            slug: packRecord.slug,
            results
        });

    } catch (error: any) {
        console.error("[Clawdbot] API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// --- Helpers ---

function sanitize(str: string) {
    return str.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function uploadImageFromUrl(url: string, path: string): Promise<string | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
        const buffer = await res.arrayBuffer();

        const { error } = await supabase.storage
            .from("bootcamp-assets")
            .upload(path, buffer, {
                contentType: res.headers.get("content-type") || "image/png",
                upsert: true
            });

        if (error) throw error;
        return path;
    } catch (e) {
        console.error("Image Upload Failed:", e);
        return null;
    }
}

function getPublicUrl(path: string) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bootcamp-assets/${path}`;
}
