import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300; // Hunyuan video foley can take several minutes

const FAL_KEY = process.env.FAL_KEY!;

export async function POST(req: Request) {
    try {
        const { prompt, video_url, duration_seconds = 5 } = await req.json();

        if (!prompt && !video_url) {
            return NextResponse.json({ error: "Prompt or Video URL is required" }, { status: 400 });
        }

        const isAuto = !!video_url;
        const COST = isAuto ? 5 : 2;
        const modelEndpoint = isAuto ? "fal-ai/hunyuan-video-foley" : "fal-ai/elevenlabs/sound-effects/v2";

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Admin client for storage & DB operations
        const adminAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Credits check
        const { data: profile } = await adminAuth
            .from("profiles")
            .select("credits, role")
            .eq("user_id", user.id)
            .single();

        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

        if (!isAdmin && (profile?.credits ?? 0) < COST) {
            return NextResponse.json(
                { error: `You need at least ${COST} credits for this tool` },
                { status: 403 }
            );
        }

        // Prepare payload
        const payload = isAuto 
            ? { video_url, text_prompt: prompt?.trim() || "" } 
            : { text: prompt?.trim(), duration_seconds: Math.min(Math.max(Number(duration_seconds), 1), 22) };

        // Submit to fal queue
        const createRes = await fetch(`https://queue.fal.run/${modelEndpoint}`, {
            method: "POST",
            headers: {
                Authorization: `Key ${FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`${isAuto ? 'Hunyuan' : 'ElevenLabs'} API error: ${createRes.status} ${errText}`);
        }

        const createData = await createRes.json();
        const statusUrl = createData.status_url;
        const resultUrl = createData.response_url;

        // Poll for completion
        let result: any;
        const maxRetries = isAuto ? 90 : 20;     // Auto up to ~270s, Single up to 40s
        const pollInterval = isAuto ? 3000 : 2000;
        for (let i = 0; i < maxRetries; i++) {
            await new Promise(r => setTimeout(r, pollInterval));
            const st = await fetch(statusUrl, {
                headers: { Authorization: `Key ${FAL_KEY}` },
            });
            const data = await st.json();

            if (data.status === "COMPLETED") {
                const res = await fetch(resultUrl, {
                    headers: { Authorization: `Key ${FAL_KEY}` },
                });
                result = await res.json();
                break;
            }
            if (data.status === "FAILED") {
                throw new Error("Generation failed.");
            }
        }

        if (!result) throw new Error("Timed out waiting for generation.");

        // Hunyuan returns a video-with-audio; ElevenLabs returns an audio file
        let audioUrl: string | null = null;
        let videoUrl: string | null = null;

        if (isAuto) {
            videoUrl = result.video?.url || result.video_url || null;
            if (!videoUrl) {
                throw new Error(`No video URL returned: ${JSON.stringify(result).slice(0, 200)}`);
            }

            // ── Persist Hunyuan Foley video to Supabase Storage & DB ──
            const BUCKET = process.env.NEXT_PUBLIC_GENERATIONS_BUCKET || "generations";
            const filePath = `videos/${user.id}/soundfx_${Date.now()}.mp4`;

            const videoRes = await fetch(videoUrl);
            if (!videoRes.ok) throw new Error(`Failed to fetch video from Fal: ${videoRes.status}`);
            const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

            const { error: uploadError } = await adminAuth.storage
                .from(BUCKET)
                .upload(filePath, videoBuffer, { contentType: "video/mp4", upsert: false });

            if (uploadError) throw new Error(`Upload to storage failed: ${uploadError.message}`);

            const { data: pubUrl } = adminAuth.storage.from(BUCKET).getPublicUrl(filePath);
            const finalVideoUrl = pubUrl.publicUrl;

            // Save to DB — use source video URL as thumbnail for library display
            const promptLabel = prompt?.trim()
                ? `Sound FX: ${prompt.trim().slice(0, 80)}`
                : "Sound FX (Auto Foley)";

            const { error: dbErr } = await adminAuth.from("video_generations").insert({
                user_id: user.id,
                video_url: finalVideoUrl,
                thumbnail_url: video_url || "", // source video as thumbnail reference
                prompt: promptLabel,
                status: "completed",
                is_public: true,
            });

            if (dbErr) console.warn("DB insert for soundfx failed:", dbErr.message);

            // Use the persistent URL going forward
            videoUrl = finalVideoUrl;
        } else {
            audioUrl = result.audio?.url || result.audio_url || result.url || null;
            if (!audioUrl) {
                throw new Error(`No audio URL returned: ${JSON.stringify(result).slice(0, 200)}`);
            }
        }

        // Deduct credits
        if (!isAdmin) {
            await adminAuth.rpc("decrement_credits", { x: COST, user_id_param: user.id });
        }

        return NextResponse.json({ audioUrl, videoUrl });
    } catch (e: any) {
        console.error("Generate SoundFX Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
