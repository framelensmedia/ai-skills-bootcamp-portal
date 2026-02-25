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

        // --- BRANCH 1: LESSON CONTENT (Training Videos) ---
        // Payload: { lesson_id: string, contents: LessonContentItem[] }
        if (body.lesson_id && body.contents) {
            const { lesson_id, contents } = body;
            console.log(`[Clawdbot] Processing Lesson Content for Lesson: ${lesson_id} (${contents.length} items)`);

            // 1. Process Contents (Re-host assets if needed)
            const processedContents = await Promise.all(contents.map(async (item: any) => {
                // Re-host Video URL if provided and external
                if (item.type === "video" && item.content?.video_url && !item.content.video_url.includes("supabase.co")) {
                    try {
                        const ext = item.content.video_url.split('.').pop() || "mp4";
                        const path = `lessons/${lesson_id}/video-${Date.now()}.${ext}`;
                        const uploaded = await uploadFileFromUrl(item.content.video_url, path);
                        if (uploaded) {
                            item.content.video_url = getPublicUrl(uploaded);
                        }
                    } catch (e) {
                        console.error("Failed to rehost video:", e);
                    }
                }
                // Re-host Thumbnail
                if (item.content?.thumbnail_url && !item.content.thumbnail_url.includes("supabase.co")) {
                    try {
                        const path = `lessons/${lesson_id}/thumb-${Date.now()}.png`;
                        const uploaded = await uploadFileFromUrl(item.content.thumbnail_url, path);
                        if (uploaded) {
                            item.content.thumbnail_url = getPublicUrl(uploaded);
                        }
                    } catch (e) { console.error("Failed to rehost thumbnail:", e); }
                }

                return {
                    lesson_id,
                    type: item.type,
                    title: item.title,
                    order_index: item.order_index,
                    content: item.content,
                    is_published: item.is_published ?? true
                };
            }));

            // 2. Insert/Upsert into lesson_contents
            const { data, error } = await supabase
                .from("lesson_contents")
                .insert(processedContents)
                .select();

            if (error) throw new Error(`Lesson Content Insert Failed: ${error.message}`);

            return NextResponse.json({ success: true, count: data.length, results: data });
        }

        // --- BRANCH 2: TEMPLATE PACKS (Legacy) ---
        const { pack, templates, author_id } = body;

        if (!pack || !pack.name || !templates || !Array.isArray(templates)) {
            return NextResponse.json({ error: "Invalid payload: 'lesson_id' OR 'pack.name' required." }, { status: 400 });
        }

        console.log(`[Clawdbot] Processing Pack: ${pack.name} with ${templates.length} templates (Max Duration: ${maxDuration}s).`);

        // 2. Prep Pack Record
        const packThumbnailUrl = pack.thumbnail_url || pack.thumbnailUrl || pack.image_url || pack.imageUrl || pack.url || null;
        const slug = pack.slug || `${sanitize(pack.name)}-${Date.now()}`;

        const packPayload: any = {
            title: pack.name,
            pack_name: pack.name,
            slug: slug,
            pack_id: slug,
            access_level: pack.access_level || "free",
            is_published: pack.is_published !== undefined ? pack.is_published : false,
            category: pack.category || "General",
            thumbnail_url: packThumbnailUrl,
            ...(pack.difficulty && { difficulty: pack.difficulty }),
            ...(pack.seo_title && { seo_title: pack.seo_title }),
            ...(pack.seo_description && { seo_description: pack.seo_description }),
        };

        // 3. Insert Pack Immediately
        const { data: packRecord, error: packError } = await supabase
            .from("template_packs")
            .insert(packPayload)
            .select()
            .single();

        if (packError) throw new Error(`Pack creation failed: ${packError.message}`);

        console.log(`[Clawdbot] Created Pack ID: ${packRecord.id} (Starting parallel processing)`);

        // 3b. Handle Tags (upsert + map) if provided
        if (Array.isArray(pack.tags) && pack.tags.length > 0) {
            try {
                await upsertAndMapTags(packRecord.id, pack.tags);
                console.log(`[Clawdbot] Applied ${pack.tags.length} tags to pack ${packRecord.id}`);
            } catch (tagErr: any) {
                console.error("[Clawdbot] Tag mapping failed (non-fatal):", tagErr.message);
            }
        }



        // 4. Parallel Process: Templates AND Thumbnail Upload
        // This prevents the Image Upload from blocking the Template Processing, reducing total latency.

        const thumbnailPromise = (async () => {
            if (packThumbnailUrl && !packThumbnailUrl.includes("supabase.co")) {
                try {
                    console.log(`[Clawdbot] Re-hosting Thumbnail: ${packThumbnailUrl}`);
                    const path = `packs/cover-${packRecord.id}-${Date.now()}.png`;
                    const uploadedPath = await uploadFileFromUrl(packThumbnailUrl, path);
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
                // REHOST IMAGE: Download the image and save to Supabase
                let previewUrl = t.image_url || t.imageUrl || t.url || t.featured_image_url || null;
                let previewPath = null;

                if (previewUrl && !previewUrl.includes("supabase.co")) {
                    console.log(`[Clawdbot] Re-hosting Template Image: ${previewUrl}`);
                    try {
                        // Generate a safe filename
                        const safeTitle = sanitize(t.title || "template");
                        const targetPath = `templates/${packRecord.id}-${safeTitle}-${Date.now()}.jpg`;

                        const uploadedPath = await uploadFileFromUrl(previewUrl, targetPath);
                        if (uploadedPath) {
                            previewPath = uploadedPath;
                            previewUrl = getPublicUrl(uploadedPath);
                        }
                    } catch (e) {
                        console.error(`[Clawdbot] Template Image Rehost Failed (${t.title}):`, e);
                        // Fall back to the original URL if upload fails
                    }
                }

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

async function upsertAndMapTags(packId: string, tagNames: string[]) {
    const upsertedIds: string[] = [];
    for (const name of tagNames) {
        const normalized = name.trim();
        if (!normalized) continue;
        const slug = normalized.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

        // Find or create tag
        let { data: tag } = await supabase.from("pack_tags").select("id").eq("name", normalized).maybeSingle();
        if (!tag) {
            const { data: created } = await supabase.from("pack_tags").insert({ name: normalized, slug }).select("id").single();
            tag = created;
        }
        if (tag?.id) upsertedIds.push(tag.id);
    }

    // Clear old mappings and insert new ones
    await supabase.from("pack_tag_map").delete().eq("pack_id", packId);
    if (upsertedIds.length > 0) {
        await supabase.from("pack_tag_map").insert(upsertedIds.map(tag_id => ({ pack_id: packId, tag_id })));
    }
}

function sanitize(str: string) {
    return str.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function uploadFileFromUrl(url: string, path: string): Promise<string | null> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for larger files

        const res = await fetch(url, {
            headers: {
                "User-Agent": "Bot/1.0",
                "Accept": "*/*"
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);

        const contentType = res.headers.get("content-type") || "application/octet-stream";
        if (contentType.includes("text/html")) {
            throw new Error(`Expected an image file, but the source URL returned a webpage (HTML).`);
        }

        const buffer = await res.arrayBuffer();

        const bucket = process.env.NEXT_PUBLIC_BOOTCAMP_ASSETS_BUCKET || "bootcamp-assets";

        const { error } = await supabase.storage
            .from(bucket)
            .upload(path, buffer, {
                contentType: res.headers.get("content-type") || "application/octet-stream",
                upsert: true
            });

        if (error) throw error;
        return path;
    } catch (e) {
        console.error("File Upload Failed:", e);
        return null; // Don't block whole process if file upload fails
    }
}

function getPublicUrl(path: string) {
    const bucket = process.env.NEXT_PUBLIC_BOOTCAMP_ASSETS_BUCKET || "bootcamp-assets";
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
