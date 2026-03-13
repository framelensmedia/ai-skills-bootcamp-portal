import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Disable Next.js body size limit – we're streaming
export const dynamic = "force-dynamic";

/**
 * GET /api/video-proxy?url=<video-url>
 *
 * Strategy:
 * - Supabase storage URLs: 302 redirect to the raw URL.
 *   Supabase (via Cloudflare) natively serves Accept-Ranges: bytes + 206 responses.
 *   Routing bytes through Next.js adds a problematic Vary header that breaks mobile Safari.
 *
 * - fal.media / fal.ai CDN URLs: Full byte-range proxy.
 *   These external CDNs may not be directly accessible by mobile browsers due to
 *   CORS or missing range-request headers. We proxy the bytes and inject the correct headers.
 */
export async function GET(req: NextRequest) {
    const rawUrl = req.nextUrl.searchParams.get("url");
    if (!rawUrl) {
        return new NextResponse("Missing url param", { status: 400 });
    }

    let parsedUrl: URL;
    try {
        parsedUrl = new URL(rawUrl);
    } catch {
        return new NextResponse("Invalid url", { status: 400 });
    }

    const hostname = parsedUrl.hostname;

    // Allow-list of hosts we'll proxy/redirect
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "")?.split("/")[0] ?? "";
    const isSupabase = supabaseHost && hostname === supabaseHost;
    const isFal = hostname.endsWith("fal.media") || hostname.endsWith("fal.ai") || hostname.endsWith("cdn.fal.ai");

    if (!isSupabase && !isFal) {
        return new NextResponse("Forbidden: unsupported host", { status: 403 });
    }

    // ── Supabase: simple redirect (it already handles ranges natively) ──
    if (isSupabase) {
        return NextResponse.redirect(rawUrl, {
            status: 302,
            headers: {
                // Tell mobile clients this supports ranges — even in redirect response
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400",
            },
        });
    }

    // ── fal.media: full byte-range proxy ──
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
