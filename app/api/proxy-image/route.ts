import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Server-side image proxy to bypass CORS restrictions.
 * Fetches an image from Supabase Storage and returns it to the client.
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const imageUrl = searchParams.get("url");

        if (!imageUrl) {
            return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
        }

        console.log("[Image Proxy] Fetching:", imageUrl);

        // Validate URL is from Supabase (security check)
        // Validate URL is from Supabase or Fal (security check)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const allowedDomains = [
            supabaseUrl.replace('https://', ''),
            "fal.media",
            "v3.fal.media",
            "v3b.fal.media"
        ];

        const isAllowed = allowedDomains.some(domain => imageUrl.includes(domain));

        if (!isAllowed) {
            console.error("[Image Proxy] Invalid URL - not allowed:", imageUrl);
            return NextResponse.json({ error: "Invalid image URL - domain not allowed" }, { status: 400 });
        }

        // Fetch the image server-side (no CORS restrictions)
        // Supabase Storage URLs may be signed, so we pass them as-is
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'NextJS-Image-Proxy/1.0',
            },
        });

        console.log("[Image Proxy] Response status:", response.status, response.statusText);

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("[Image Proxy] Fetch failed:", {
                status: response.status,
                statusText: response.statusText,
                body: errorBody.substring(0, 200),
                url: imageUrl
            });

            return NextResponse.json(
                {
                    error: `Failed to fetch image: ${response.statusText}`,
                    details: errorBody.substring(0, 200),
                    status: response.status
                },
                { status: response.status }
            );
        }

        // Get image data
        const blob = await response.blob();
        const buffer = Buffer.from(await blob.arrayBuffer());

        console.log("[Image Proxy] Successfully proxied image, size:", buffer.length, "bytes");

        // Return image with proper headers
        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": response.headers.get("content-type") || "image/png",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*", // Allow CORS for client
            },
        });
    } catch (error: any) {
        console.error("[Image Proxy] Unexpected error:", error);
        return NextResponse.json(
            { error: "Failed to proxy image", details: error.message },
            { status: 500 }
        );
    }
}
