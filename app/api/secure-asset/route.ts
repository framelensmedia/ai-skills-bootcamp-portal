import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Server-side API to secure external assets by downloading them
 * and re-uploading to Supabase storage. Bypasses CORS restrictions.
 */
export async function POST(req: Request) {
    try {
        const { url, bucket = "bootcamp-assets", folder = "secured", filename } = await req.json();

        if (!url) {
            return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
        }

        // Skip if already a Supabase URL
        if (url.includes("supabase.co")) {
            return NextResponse.json({ success: true, url });
        }

        console.log("[Secure Asset] Fetching:", url);

        // Server-side fetch with browser-like headers (no CORS restrictions)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error("[Secure Asset] Fetch failed:", response.status, response.statusText);
            return NextResponse.json(
                { error: `Failed to fetch: ${response.statusText}` },
                { status: response.status }
            );
        }

        // Get blob data
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());

        // Determine file extension
        const contentType = response.headers.get("content-type") || "image/jpeg";
        const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";

        // Generate filename
        const finalFilename = filename
            ? `${folder}/${filename}.${ext}`
            : `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        console.log("[Secure Asset] Uploading to:", finalFilename);

        // Upload to Supabase
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(finalFilename, buffer, {
                contentType,
                upsert: true
            });

        if (uploadError) {
            console.error("[Secure Asset] Upload error:", uploadError);
            return NextResponse.json(
                { error: `Upload failed: ${uploadError.message}` },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(finalFilename);

        console.log("[Secure Asset] Secured successfully:", publicUrl);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            path: finalFilename
        });

    } catch (error: any) {
        console.error("[Secure Asset] Unexpected error:", error);
        return NextResponse.json(
            { error: "Failed to secure asset", details: error.message },
            { status: 500 }
        );
    }
}
