/**
 * Wraps a Supabase storage video URL to route through our /api/video-proxy
 * endpoint, which adds proper Range-request headers needed by mobile Safari.
 *
 * Only wraps URLs belonging to our Supabase project.
 * Pass-through everything else (external CDN URLs, blob:, data:, etc).
 */
export function proxyVideoUrl(url: string | null | undefined): string {
    if (!url) return "";

    // Don't proxy non-Supabase URLs or non-http URLs
    if (!url.startsWith("http")) return url;

    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const isSupabase = (supabaseHost && url.includes(supabaseHost.replace("https://", ""))) || url.includes("supabase.co");
    
    if (isSupabase) {
        return `/api/video-proxy?url=${encodeURIComponent(url)}`;
    }

    return url;
}
