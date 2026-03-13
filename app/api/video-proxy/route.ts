import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Disable Next.js body size limit – we're streaming
export const dynamic = "force-dynamic";

/**
 * GET /api/video-proxy?url=<supabase-public-video-url>
 *
 * Proxies videos from Supabase storage and adds Range-request support.
 * This is required for mobile Safari (iPhone) which MUST have byte-range
 * responses to stream / play video.
 */
export async function GET(req: NextRequest) {
    const rawUrl = req.nextUrl.searchParams.get("url");
    if (!rawUrl) {
        return new NextResponse("Missing url param", { status: 400 });
    }

    // Basic safety: only proxy our own Supabase storage URLs
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "")?.split("/")[0];
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return new NextResponse("Invalid url", { status: 400 });
    }

    if (supabaseHost && parsedUrl.hostname !== supabaseHost) {
        return new NextResponse("Forbidden: only Supabase URLs allowed", { status: 403 });
    }

    const rangeHeader = req.headers.get("range") || undefined;

    const upstreamHeaders: HeadersInit = {
        "User-Agent": "Mozilla/5.0",
    };
    if (rangeHeader) {
        upstreamHeaders["Range"] = rangeHeader;
    }

    const upstream = await fetch(rawUrl, { headers: upstreamHeaders });

    if (!upstream.ok && upstream.status !== 206) {
        return new NextResponse("Upstream error: " + upstream.status, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "video/mp4";
    const contentLength = upstream.headers.get("content-length");
    const contentRange = upstream.headers.get("content-range");

    const responseHeaders: HeadersInit = {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
    };

    if (contentLength) responseHeaders["Content-Length"] = contentLength;
    if (contentRange) responseHeaders["Content-Range"] = contentRange;

    const status = rangeHeader && upstream.status === 206 ? 206 : upstream.status;

    return new NextResponse(upstream.body, {
        status,
        headers: responseHeaders,
    });
}
