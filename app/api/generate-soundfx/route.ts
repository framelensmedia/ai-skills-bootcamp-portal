import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const maxDuration = 300; // Hunyuan video foley can take several minutes

const FAL_KEY = process.env.FAL_KEY!;
const COST = 2;

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

        // Credits check
        const { data: profile } = await supabase
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
        } else {
            audioUrl = result.audio?.url || result.audio_url || result.url || null;
            if (!audioUrl) {
                throw new Error(`No audio URL returned: ${JSON.stringify(result).slice(0, 200)}`);
            }
        }

        // Deduct credits
        if (!isAdmin) {
            await supabase.rpc("decrement_credits", { x: COST, user_id_param: user.id });
        }

        return NextResponse.json({ audioUrl, videoUrl });
    } catch (e: any) {
        console.error("Generate SoundFX Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
