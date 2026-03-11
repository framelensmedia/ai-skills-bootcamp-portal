import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(req: Request) {
    try {
        const { imageUrl, videoUrl, prompt, aspectRatio } = await req.json();

        if (!imageUrl || !videoUrl) {
            return NextResponse.json({ error: "Both Image URL and Video URL are required for motion transfer." }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient();

        // 1. Authenticate Request
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // 2. Validate Credits
        const COST = 5;
        const { data: profile } = await supabase.from("profiles")
            .select("credits, role")
            .eq("user_id", user.id)
            .single();

        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

        if (!isAdmin && (profile?.credits ?? 0) < COST) {
            return NextResponse.json({ error: `Insufficient credits. This action requires ${COST} credits.` }, { status: 403 });
        }

        // 3. Call Fal.ai Wan Animate API via Queue
        const falToken = process.env.FAL_KEY;
        const submitRes = await fetch("https://queue.fal.run/fal-ai/wan/v2.2-14b/animate/move", {
            method: "POST",
            headers: {
                "Authorization": `Key ${falToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                image_url: imageUrl,
                video_url: videoUrl,
                prompt: prompt || "Smooth slow pan and subtle cinematic motion.",
                aspect_ratio: aspectRatio || "16:9",
                sync_audio: true
            })
        });

        const initialJson = await submitRes.json();

        if (!submitRes.ok) {
            throw new Error(initialJson.error || initialJson.detail?.[0]?.msg || "Failed to submit queue to Fal.ai");
        }

        const requestId = initialJson.request_id;
        const responseUrl = initialJson.response_url;

        // 4. Create Pending Record BEFORE polling
        // We use thumbnail_url as a temporary hack to store the fal_response_url
        const { data: newRow, error: dbErr } = await supabase
            .from("video_generations")
            .insert({
                user_id: user.id,
                prompt: prompt || "Wan Animate Image",
                video_url: "", // will update later
                status: "pending",
                is_public: true,
                thumbnail_url: responseUrl, // temp storage for check-video-generation
            })
            .select("id")
            .single();

        if (dbErr || !newRow) {
            throw new Error(`Failed to create pending database record: ${dbErr?.message}`);
        }

        const pendingGenerationId = newRow.id;

        // Deduct upfront
        if (!isAdmin) {
            await supabase.rpc("decrement_credits", { x: COST, user_id_param: user.id });
        }

        if (!requestId) {
            // Might be completed immediately
            if (initialJson.video?.url) {
                return await updateAndReturn(initialJson.video.url, pendingGenerationId, user.id, isAdmin, (profile?.credits ?? 0) - COST, supabase);
            }
            throw new Error("No request_id returned from Fal queue");
        }

        // 5. Poll Queue
        const startTime = Date.now();
        const TIMEOUT_MS = 280000; // 4.6 minutes (leaves 20s for Vercel 300s limit)
        let resultVideoUrl: string | null = null;
        let attempts = 0;

        while (Date.now() - startTime < TIMEOUT_MS) {
            attempts++;
            await new Promise(r => setTimeout(r, 5000)); // Poll every 5s

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
                } catch (_) { /* ignore and fallback to status polling */ }
            }

            const statusRes = await fetch(`https://queue.fal.run/fal-ai/wan/v2.2-14b/animate/move/requests/${requestId}/status`, {
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
                // Return failed state
                await supabase.from("video_generations").update({ status: "failed" }).eq("id", pendingGenerationId);
                throw new Error("Fal.ai generation failed internally");
            }
        }

        if (!resultVideoUrl) {
            // TIMEOUT - Return HTTP 202 to hand off to frontend polling
            return NextResponse.json(
                { status: "pending", generationId: pendingGenerationId, remainingCredits: !isAdmin ? ((profile?.credits ?? 0) - COST) : profile?.credits },
                { status: 202 }
            );
        }

        // SUCCESS in backend
        return await updateAndReturn(resultVideoUrl, pendingGenerationId, user.id, isAdmin, (profile?.credits ?? 0) - COST, supabase);

    } catch (error: any) {
        console.error("Wan Animate Error:", error);
        return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 });
    }
}

async function updateAndReturn(resultVideoUrl: string, generationId: string, userId: string, isAdmin: boolean, remainingCredits: number, supabase: any) {
    // Update DB to completed
    const { error: dbErr } = await supabase
        .from("video_generations")
        .update({
            video_url: resultVideoUrl,
            status: "completed",
            thumbnail_url: null, // clear temp URL
        })
        .eq("id", generationId);

    if (dbErr) {
        throw new Error(`Failed to update database record: ${dbErr.message}`);
    }

    return NextResponse.json({ videoUrl: resultVideoUrl, id: generationId, remainingCredits: isAdmin ? undefined : remainingCredits });
}
