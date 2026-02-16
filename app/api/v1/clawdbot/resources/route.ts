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
        const { resource } = body;

        if (!resource || !resource.title || !resource.url) {
            return NextResponse.json({ error: "Missing required fields: resource.title, resource.url" }, { status: 400 });
        }

        console.log(`[Clawdbot] Creating Resource: ${resource.title}`);

        const payload: any = {
            title: resource.title,
            description: resource.description || "",
            type: resource.type || "link",
            is_public: resource.is_public ?? true,
            url: resource.url
        };

        // 2. Re-host File if requested (optional flag "rehost": true)
        // Only re-host if it looks like a file and client explicitly asked OR if it's not a simple link
        if (resource.rehost && resource.url && !resource.url.includes("supabase.co")) {
            try {
                const ext = resource.url.split('.').pop()?.split('?')[0] || "file";
                const path = `resources/${sanitize(resource.title)}-${Date.now()}.${ext}`;
                const uploadedPath = await uploadFileFromUrl(resource.url, path);

                if (uploadedPath) {
                    payload.url = getPublicUrl(uploadedPath);
                    // Try to get size
                    // (Skipping size check for now to simpler logic, can be added if needed)
                }
            } catch (e) {
                console.error("[Clawdbot] Resource Rehost Failed:", e);
                // Fallback to original URL
            }
        }

        // 3. Insert
        const { data, error } = await supabase
            .from("resources")
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, resource: data });

    } catch (e: any) {
        console.error("[Clawdbot] Resource API Error:", e);
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
