import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

const FAL_KEY = process.env.FAL_KEY!;

// ------------ Helpers ------------

async function generateTTSAudio(voiceId: string, refAudioUrl: string, script: string): Promise<string> {
    const isPreset = !voiceId.includes("-"); // UUIDs have dashes, preset names don't

    if (isPreset) {
        // ChatterboxHD Text-to-Speech
        const res = await fetch("https://fal.run/resemble-ai/chatterboxhd/text-to-speech", {
            method: "POST",
            headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text: script, voice: voiceId })
        });
        if (!res.ok) throw new Error(`ChatterboxHD TTS failed: ${res.status} ${await res.text()}`);
        const data = await res.json();
        if (data.audio?.url) return data.audio.url;
        throw new Error("ChatterboxHD returned no audio URL");
    } else {
        // F5-TTS for cloned voices
        if (!refAudioUrl) throw new Error("A reference audio URL is required for cloned voice TTS");
        const res = await fetch("https://fal.run/fal-ai/f5-tts", {
            method: "POST",
            headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ gen_text: script, ref_audio_url: refAudioUrl, model_type: "F5-TTS", remove_silence: true })
        });
        if (!res.ok) throw new Error(`F5-TTS failed: ${res.status} ${await res.text()}`);
        const data = await res.json();
        if (data.audio_url?.url) return data.audio_url.url;
        if (data.audio?.url) return data.audio.url;
        throw new Error("F5-TTS returned no audio URL");
    }
}

async function extractAudioFromVideo(videoUrl: string): Promise<string> {
    // Use Fal FFmpeg to extract audio track from the video for S2S mode
    const endpoint = "https://queue.fal.run/fal-ai/ffmpeg-api/extract-audio";
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Audio extraction failed: ${res.status} ${err}`);
    }
    const { request_id } = await res.json();

    for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`https://queue.fal.run/fal-ai/ffmpeg-api/extract-audio/requests/${request_id}`, {
            headers: { "Authorization": `Key ${FAL_KEY}` }
        });
        if (!statusRes.ok) continue;
        const data = await statusRes.json();
        if (data.status === "COMPLETED") {
            const audioUrl = data.audio?.url || data.audio_url?.url || data.url;
            if (!audioUrl) throw new Error("Extract audio completed but returned no URL");
            return audioUrl;
        }
        if (data.status === "FAILED" || data.status === "ERROR") throw new Error(`Audio extraction failed: ${JSON.stringify(data)}`);
    }
    throw new Error("Audio extraction timed out");
}

async function runChatterboxS2S(sourceAudioUrl: string, refAudioUrl: string): Promise<string> {
    const res = await fetch("https://fal.run/resemble-ai/chatterboxhd/speech-to-speech", {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: sourceAudioUrl, ref_audio_url: refAudioUrl })
    });
    if (!res.ok) throw new Error(`ChatterboxHD S2S failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (data.audio?.url) return data.audio.url;
    if (data.audio_url?.url) return data.audio_url.url;
    throw new Error("ChatterboxHD S2S returned no audio URL");
}

async function mergeAudioVideo(videoUrl: string, audioUrl: string): Promise<string> {
    const endpoint = "https://queue.fal.run/fal-ai/ffmpeg-api/merge-audio-video";
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: videoUrl, audio_url: audioUrl })
    });
    if (!res.ok) throw new Error(`Merge start failed: ${res.status} ${await res.text()}`);
    const { request_id } = await res.json();

    for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const statusRes = await fetch(`https://queue.fal.run/fal-ai/ffmpeg-api/merge-audio-video/requests/${request_id}`, {
            headers: { "Authorization": `Key ${FAL_KEY}` }
        });
        if (!statusRes.ok) continue;
        const data = await statusRes.json();
        if (data.status === "COMPLETED") {
            const url = data.video?.url || data.url || data.video_url;
            if (!url) throw new Error("Merge completed but returned no URL");
            return url;
        }
        if (data.status === "FAILED" || data.status === "ERROR") throw new Error(`Merge failed: ${JSON.stringify(data)}`);
    }
    throw new Error("Merge timed out");
}

// ------------ Route Handler ------------

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { videoUrl, mode, voiceId, refAudioUrl, script } = body;

        if (!videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
        if (!voiceId) return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
        if (!mode || (mode !== "s2s" && mode !== "voiceover")) {
            return NextResponse.json({ error: "mode must be 's2s' or 'voiceover'" }, { status: 400 });
        }

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Credits check
        const VOICE_VIDEO_COST = 10;
        const { data: profile } = await supabase.from("profiles").select("credits, role").eq("user_id", user.id).single();
        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
        if (!isAdmin && (profile?.credits ?? 0) < VOICE_VIDEO_COST) {
            return NextResponse.json({ error: `You need at least ${VOICE_VIDEO_COST} credits for this feature` }, { status: 403 });
        }

        let finalAudioUrl: string;

        if (mode === "s2s") {
            // Step 1: Extract original audio from the video
            const sourceAudioUrl = await extractAudioFromVideo(videoUrl);
            // Step 2: Run ChatterboxHD Speech-to-Speech with the user's reference voice
            finalAudioUrl = await runChatterboxS2S(sourceAudioUrl, refAudioUrl);
        } else {
            // Voiceover mode: generate fresh TTS from script
            if (!script?.trim()) return NextResponse.json({ error: "A script is required for voiceover mode" }, { status: 400 });
            finalAudioUrl = await generateTTSAudio(voiceId, refAudioUrl, script);
        }

        // Step 3: Merge audio onto video
        const mergedVideoUrl = await mergeAudioVideo(videoUrl, finalAudioUrl);

        // Step 4: Download and re-upload to Supabase for persistence
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const admin = createClient(supabaseUrl, serviceRole, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
        });

        const BUCKET = process.env.NEXT_PUBLIC_GENERATIONS_BUCKET || "generations";
        const modeLabel = mode === "s2s" ? "s2s" : "voiced";
        const filePath = `videos/${user.id}/${modeLabel}_${Date.now()}.mp4`;

        const videoRes = await fetch(mergedVideoUrl);
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

        const { error: uploadError } = await admin.storage
            .from(BUCKET)
            .upload(filePath, videoBuffer, { contentType: "video/mp4", upsert: false });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: pubData } = admin.storage.from(BUCKET).getPublicUrl(filePath);
        const savedVideoUrl = pubData.publicUrl;

        // Step 5: Save to DB
        const { data: newRow, error: dbErr } = await admin.from("video_generations").insert({
            user_id: user.id,
            video_url: savedVideoUrl,
            prompt: mode === "s2s" ? `[Voice Replaced] Original video with voice replaced` : `[Voiceover] ${script?.slice(0, 100)}`,
            status: "completed",
            is_public: true,
        }).select().single();

        if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

        // Deduct credits
        if (!isAdmin) {
            await admin.rpc("decrement_credits", { x: VOICE_VIDEO_COST, user_id_param: user.id });
        }

        return NextResponse.json({ videoUrl: savedVideoUrl, id: newRow?.id });

    } catch (e: any) {
        console.error("Replace Voice Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
