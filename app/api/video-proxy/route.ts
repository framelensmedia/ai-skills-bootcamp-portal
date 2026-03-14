import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Disable Next.js body size limit – we're streaming
export const dynamic = "force-dynamic";

/**
 * GET /api/video-proxy?url=<video-url>
 *
 * Streams bytes for ALL video sources (Supabase + fal.ai).
 *
 * iOS Safari/Chrome (WebKit) does NOT reliably follow 302 redirects
 * for <video> byte-range requests. When crossing origins via redirect,
 * the Range headers are dropped and the video stalls on the poster frame.
 *
 * By streaming server-side we:
 * - Fetch from the upstream origin (no CORS issues, server-to-server)
 * - Return bytes to iOS with explicit Accept-Ranges/Content-Range headers
 * - iOS sees a same-origin response it can range-request normally
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

    // Allow-list of hosts we'll proxy
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "")?.split("/")[0] ?? "";
    const isSupabase = !!(supabaseHost && hostname === supabaseHost) || hostname.endsWith("supabase.co");
    const isFal = hostname.endsWith("fal.media") || hostname.endsWith("fal.ai") || hostname.endsWith("cdn.fal.ai");

    if (!isSupabase && !isFal) {
        return new NextResponse("Forbidden: unsupported host", { status: 403 });
    }

    // Pass through the Range header so the upstream returns a 206 partial response
    const rangeHeader = req.headers.get("range") || undefined;

    const upstreamHeaders: HeadersInit = {
        "User-Agent": "Mozilla/5.0",
    };
    if (rangeHeader) {
        upstreamHeaders["Range"] = rangeHeader;
    }

    let upstream: Response;
    try {
        upstream = await fetch(rawUrl, { headers: upstreamHeaders });
    } catch (err) {
        return new NextResponse("Failed to fetch upstream: " + String(err), { status: 502 });
    }

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
