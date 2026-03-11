import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { imageUrl, audioUrl, prompt, aspectRatio } = await req.json();

        if (!imageUrl || !audioUrl) {
            return NextResponse.json({ error: "Both Image URL and Audio URL are required for audio-to-video generation." }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient();

        // 1. Authenticate Request
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Validate Credits
        const COST = 10;
        const { data: profile } = await supabase.from("profiles")
            .select("credits, role")
            .eq("user_id", user.id)
            .single();

        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

        if (!isAdmin && (profile?.credits ?? 0) < COST) {
            return NextResponse.json({ error: `Insufficient credits. This action requires ${COST} credits.` }, { status: 403 });
        }

        // 3. Call Fal.ai LTX Audio-to-Video API via Queue
        const falToken = process.env.FAL_KEY;
        const submitRes = await fetch("https://queue.fal.run/fal-ai/ltx-2.3/audio-to-video", {
            method: "POST",
            headers: {
                "Authorization": `Key ${falToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                image_url: imageUrl,
                audio_url: audioUrl,
                prompt: prompt || "A cinematic scene perfectly synced to the audio.",
                aspect_ratio: aspectRatio || "16:9",
            })
        });

        const initialJson = await submitRes.json();

        if (!submitRes.ok) {
            throw new Error(initialJson.error || initialJson.detail?.[0]?.msg || "Failed to submit queue to Fal.ai LTX model");
        }

        const requestId = initialJson.request_id;
        const responseUrl = initialJson.response_url;

        // 4. Create Pending Record BEFORE polling
        const { data: newRow, error: dbErr } = await supabase
            .from("video_generations")
            .insert({
                user_id: user.id,
                prompt: prompt || "LTX Audio-to-Video",
                video_url: "",
                status: "pending",
                is_public: true,
                thumbnail_url: responseUrl,
            })
            .select("id")
            .single();

        if (dbErr || !newRow) {
            throw new Error(`Failed to create pending database record: ${dbErr?.message}`);
        }

        const pendingGenerationId = newRow.id;

        if (!isAdmin) {
            await supabase.rpc("decrement_credits", { x: COST, user_id_param: user.id });
        }

        if (!requestId) {
            if (initialJson.video?.url) {
                return await updateAndReturn(initialJson.video.url, pendingGenerationId, user.id, isAdmin, (profile?.credits ?? 0) - COST, supabase);
            }
            throw new Error("No request_id returned from Fal queue");
        }

        // 5. Poll Queue
        const startTime = Date.now();
        const TIMEOUT_MS = 280000;
        let resultVideoUrl: string | null = null;
        let attempts = 0;

        while (Date.now() - startTime < TIMEOUT_MS) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000));

            if (responseUrl) {
                try {
                    const ctrl = new AbortController();
                    const tid = setTimeout(() => ctrl.abort(), 5000);
                    const directRes = await fetch(responseUrl, {
                        headers: { "Authorization": `Key ${falToken}` },
                        signal: ctrl.signal,
                    });
                    clearTimeout(tid);
                    if (directRes.ok) {
                        const directJson = await directRes.json();
                        if (directJson.video?.url) {
                            resultVideoUrl = directJson.video.url;
                            break;
                        }
                    }
                } catch (_) { }
            }

            const statusRes = await fetch(`https://queue.fal.run/fal-ai/ltx-2.3/audio-to-video/requests/${requestId}/status`, {
                headers: { "Authorization": `Key ${falToken}` }
            });

            if (!statusRes.ok) continue;

            const statusJson = await statusRes.json();

            if (statusJson.status === "COMPLETED") {
                if (statusJson.video?.url) {
                    resultVideoUrl = statusJson.video.url;
                    break;
                }
                if (responseUrl) {
                    const finalRes = await fetch(responseUrl, { headers: { "Authorization": `Key ${falToken}` } });
                    const finalJson = await finalRes.json();
                    resultVideoUrl = finalJson.video?.url;
                    break;
                }
            } else if (statusJson.status === "FAILED") {
                await supabase.from("video_generations").update({ status: "failed" }).eq("id", pendingGenerationId);
                throw new Error("Fal.ai generation failed internally");
            }
        }

        if (!resultVideoUrl) {
            return NextResponse.json(
                { status: "pending", generationId: pendingGenerationId, remainingCredits: !isAdmin ? ((profile?.credits ?? 0) - COST) : profile?.credits },
                { status: 202 }
            );
        }

        return await updateAndReturn(resultVideoUrl, pendingGenerationId, user.id, isAdmin, (profile?.credits ?? 0) - COST, supabase);

    } catch (error: any) {
        console.error("LTX Audio-to-Video Error:", error);
        return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 });
    }
}

async function updateAndReturn(resultVideoUrl: string, generationId: string, userId: string, isAdmin: boolean, remainingCredits: number, supabase: any) {
    const { error: dbErr } = await supabase
        .from("video_generations")
        .update({
            video_url: resultVideoUrl,
            status: "completed",
            thumbnail_url: null,
        })
        .eq("id", generationId);

    if (dbErr) {
        throw new Error(`Failed to update database record: ${dbErr.message}`);
    }

    return NextResponse.json({ videoUrl: resultVideoUrl, id: generationId, remainingCredits: isAdmin ? undefined : remainingCredits });
}
