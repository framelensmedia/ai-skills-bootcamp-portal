import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300; // Allow up to 5 minutes (if plan permits)

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

        console.log(`[Clawdbot] Processing Pack: ${pack.name} with ${templates.length} templates (Max Duration: ${maxDuration}s).`);

        // 2. Prep Pack Record (Use External URL initially)
        const packThumbnailUrl = pack.thumbnail_url || pack.thumbnailUrl || pack.image_url || pack.imageUrl || pack.url || null;
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
            thumbnail_url: packThumbnailUrl, // Use the external URL initially
        };

        // 3. Insert Pack Immediately
        const { data: packRecord, error: packError } = await supabase
            .from("template_packs")
            .insert(packPayload)
            .select()
            .single();

        if (packError) throw new Error(`Pack creation failed: ${packError.message}`);

        console.log(`[Clawdbot] Created Pack ID: ${packRecord.id} (Starting parallel processing)`);

        // 4. Parallel Process: Templates AND Thumbnail Upload
        // This prevents the Image Upload from blocking the Template Processing, reducing total latency.

        const thumbnailPromise = (async () => {
            if (packThumbnailUrl && !packThumbnailUrl.includes("supabase.co")) {
                try {
                    console.log(`[Clawdbot] Re-hosting Thumbnail: ${packThumbnailUrl}`);
                    const path = `packs/cover-${packRecord.id}-${Date.now()}.png`;
                    const uploadedPath = await uploadImageFromUrl(packThumbnailUrl, path);
                    if (uploadedPath) {
                        const publicUrl = getPublicUrl(uploadedPath);
                        await supabase.from("template_packs").update({ thumbnail_url: publicUrl }).eq("id", packRecord.id);
                        return publicUrl;
                    }
                } catch (e) {
                    console.error("[Clawdbot] Thumbnail Rehost Failed:", e);
                }
            }
            return packThumbnailUrl; // Return original URL if no rehost or rehost failed
        })();

        const templatesPromise = Promise.all(templates.map(async (t: any) => {
            try {
                // SIMPLIFICATION: Skip Image Download/Upload. Use raw URL.
                // ROBUSTNESS: Check multiple common keys
                const previewUrl = t.image_url || t.imageUrl || t.url || t.featured_image_url || null;
                const previewPath = null; // No storage path if using external URL

                const promptPayload: any = {
                    template_pack_id: packRecord.id,
                    title: t.title,
                    slug: `${sanitize(t.title)}-${Date.now()}`,
                    prompt_text: t.prompt_text || "",
                    prompt: t.prompt_text || "",
                    access_level: t.access_level || pack.access_level || "free",
                    status: pack.is_published ? "published" : "draft",
                    media_type: "image",
                    preview_image_storage_path: previewPath,
                    featured_image_url: previewUrl,
                };

                // Only add author_id if explicitly provided, otherwise allow DB default (or NULL)
                if (author_id) {
                    promptPayload.author_id = author_id;
                }

                const { data: promptRecord, error: promptError } = await supabase
                    .from("prompts")
                    .insert(promptPayload)
                    .select("id")
                    .single();

                if (promptError) throw promptError;
                return { title: t.title, status: "success", id: promptRecord.id };

            } catch (err: any) {
                console.error(`[Clawdbot] Template Error (${t.title}):`, err);
                return { title: t.title, status: "error", error: err.message };
            }
        }));

        const [finalThumbnail, results] = await Promise.all([thumbnailPromise, templatesPromise]);

        return NextResponse.json({
            success: true,
            pack_id: packRecord.id,
            slug: packRecord.slug,
            thumbnail_url: finalThumbnail,
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
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
        return null; // Don't block whole process if image fails
    }
}

function getPublicUrl(path: string) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bootcamp-assets/${path}`;
}
