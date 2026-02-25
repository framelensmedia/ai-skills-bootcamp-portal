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
        .from("prompt_generations")
        .select("id, image_url, settings")
        .eq("id", id)
        .single();

    if (error || !gen) {
        return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    // Already complete
    if (gen.image_url) {
        return NextResponse.json({ status: "completed", imageUrl: gen.image_url, generationId: id });
    }

    // Try fetching from Fal's response_url
    const falResponseUrl = gen.settings?.fal_response_url;
    const falKey = process.env.FAL_KEY;

    if (falResponseUrl && falKey) {
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
                const imageUrl = falJson.images?.[0]?.url || falJson.image?.url;

                if (imageUrl) {
                    // Update the DB record with the real image URL
                    await admin
                        .from("prompt_generations")
                        .update({
                            image_url: imageUrl,
                            settings: { ...gen.settings, status: "completed" },
                        })
                        .eq("id", id);

                    return NextResponse.json({ status: "completed", imageUrl, generationId: id });
                }
            }
        } catch {
            // Timed out or Fal not ready yet
        }
    }

    return NextResponse.json({ status: "pending", generationId: id });
}
