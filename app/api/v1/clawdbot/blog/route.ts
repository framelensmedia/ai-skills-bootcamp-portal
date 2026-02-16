import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin Client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
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
        const { post } = body;

        if (!post || !post.title) {
            return NextResponse.json({ error: "Missing required field: post.title" }, { status: 400 });
        }

        console.log(`[Clawdbot] Creating Blog Post: ${post.title}`);

        // 2. Prepare Payload
        const slug = post.slug || sanitize(post.title) + "-" + Date.now();
        const payload: any = {
            title: post.title,
            slug: slug,
            content: post.content || "",
            excerpt: post.excerpt || "",
            is_published: post.is_published ?? false,
            published_at: post.published_at || (post.is_published ? new Date().toISOString() : null),
            tags: post.tags || [],
            author_id: post.author_id || null // Optional, normally service role creates it
        };

        // 3. Re-host Image if provided
        if (post.featured_image_url && !post.featured_image_url.includes("supabase.co")) {
            try {
                const path = `blog/cover-${slug}-${Date.now()}.png`;
                const uploadedPath = await uploadFileFromUrl(post.featured_image_url, path);
                if (uploadedPath) {
                    payload.featured_image_url = getPublicUrl(uploadedPath);
                }
            } catch (e) {
                console.error("[Clawdbot] Image Rehost Failed:", e);
                // Fallback to original URL
                payload.featured_image_url = post.featured_image_url;
            }
        } else if (post.featured_image_url) {
            payload.featured_image_url = post.featured_image_url;
        }

        // 4. Insert
        const { data, error } = await supabase
            .from("blog_posts")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, post: data });

    } catch (e: any) {
        console.error("[Clawdbot] Blog API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// --- Helpers ---

function sanitize(str: string) {
    return str.replace(/[^a-z0-9]/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
}

async function uploadFileFromUrl(url: string, path: string): Promise<string | null> {
    try {
        const res = await fetch(url, { headers: { "User-Agent": "Bot/1.0" } });
        if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
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
        return null;
    }
}

function getPublicUrl(path: string) {
    const bucket = process.env.NEXT_PUBLIC_BOOTCAMP_ASSETS_BUCKET || "bootcamp-assets";
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}
