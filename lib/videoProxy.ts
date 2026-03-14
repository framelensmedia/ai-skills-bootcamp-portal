/**
 * Wraps a video URL to route through our /api/video-proxy endpoint.
 *
 * - Supabase storage URLs → pass through DIRECTLY.
 *   Supabase natively supports Accept-Ranges: bytes + 206 range responses.
 *   Routing through the proxy (even with a 302 redirect) breaks iOS Safari,
 *   which does NOT reliably follow 302 redirects for <video> src byte-range requests.
 *
 * - fal.media / fal.ai CDN URLs → proxy streams the bytes with correct range
 *   headers (mobile Safari can't reliably access these cross-origin CDNs).
 *
 * - All other URLs (blob:, data:, etc.) → pass through unchanged.
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

    // Only proxy fal.ai/fal.media — these CDNs lack proper CORS/range headers
    // for cross-origin mobile browser access.
    const isFal = hostname.endsWith("fal.media") || hostname.endsWith("fal.ai");

    if (isFal) {
        return `/api/video-proxy?url=${encodeURIComponent(url)}`;
    }

    // Everything else (Supabase, etc.) — pass through directly.
    return url;
}
