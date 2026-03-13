/**
 * Wraps a video URL to route through our /api/video-proxy endpoint.
 *
 * - Supabase storage URLs → proxy redirects to the raw URL (Supabase natively
 *   supports Accept-Ranges: bytes, so no byte-streaming needed)
 * - fal.media / fal.ai CDN URLs → proxy streams the bytes with correct range
 *   headers (mobile Safari can't reliably access these cross-origin CDNs)
 * - All other URLs (blob:, data:, etc.) → pass through unchanged
 */
export function proxyVideoUrl(url: string | null | undefined): string {
    if (!url) return "";

    // Don't proxy non-http URLs (blob:, data:, relative paths)
    if (!url.startsWith("http")) return url;

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return url;
    }

    const hostname = parsed.hostname;

    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace("https://", "").split("/")[0] ?? "";
    const isSupabase = !!(supabaseHost && hostname === supabaseHost) || hostname.endsWith("supabase.co");
    const isFal = hostname.endsWith("fal.media") || hostname.endsWith("fal.ai");

    if (isSupabase || isFal) {
        return `/api/video-proxy?url=${encodeURIComponent(url)}`;
    }

    return url;
}
