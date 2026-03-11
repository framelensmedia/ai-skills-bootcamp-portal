import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const admin = createClient(supabaseUrl, serviceRole);

    // Look up the generation record
    const { data: gen, error } = await admin
        .from("video_generations")
        .select("id, video_url, status, thumbnail_url")
        .eq("id", id)
        .single();

    if (error || !gen) {
        return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // Already complete
    if (gen.status === "completed" && gen.video_url) {
        return NextResponse.json({ status: "completed", videoUrl: gen.video_url, generationId: id });
    }

    // We stored fal_response_url in thumbnail_url for pending status
    const falResponseUrl = gen.thumbnail_url;
    const falKey = process.env.FAL_KEY;

    if (falResponseUrl && falResponseUrl.includes("fal.run") && falKey) {
        try {
            const ac = new AbortController();
            const t = setTimeout(() => ac.abort(), 8000); // 8s timeout
            const falRes = await fetch(falResponseUrl, {
                headers: { Authorization: `Key ${falKey}` },
                signal: ac.signal,
            });
            clearTimeout(t);

            if (falRes.ok) {
                const falJson = await falRes.json();
                const videoUrl = falJson.video?.url;

                if (videoUrl) {
                    // Update the DB record with the real video URL
                    await admin
                        .from("video_generations")
                        .update({
                            video_url: videoUrl,
                            status: "completed",
                            thumbnail_url: null, // clear the temp URL
                        })
                        .eq("id", id);

                    return NextResponse.json({ status: "completed", videoUrl, generationId: id });
                }
            }
        } catch {
            // Timed out or Fal not ready yet
        }
    }

    return NextResponse.json({ status: "pending", generationId: id });
}
