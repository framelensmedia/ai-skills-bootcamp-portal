import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Set the ffmpeg path from the installer
ffmpeg.setFfmpegPath(ffmpegInstaller.path); export const runtime = "nodejs";
export const maxDuration = 300;

const FAL_KEY = process.env.FAL_KEY!;

// ─── Helper: Poll any Fal queue endpoint ────────────────────────────────────
async function falPoll(statusUrl: string, resultUrl: string, label: string, maxSeconds = 240): Promise<any> {
    const maxAttempts = Math.ceil(maxSeconds / 2);
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const st = await fetch(statusUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
        if (!st.ok) { console.warn(`${label} poll HTTP ${st.status}`); continue; }
        const data = await st.json();
        const status = (data.status || "").toUpperCase();
        if (i % 10 === 0) console.log(`${label} poll ${i * 2}s: ${data.status}`);
        if (status === "COMPLETED") {
            const res = await fetch(resultUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
            const result = await res.json();
            if (result.detail && !result.video && !result.audio) {
                const msg = Array.isArray(result.detail) ? result.detail.map((d: any) => d.msg).join("; ") : String(result.detail);
                throw new Error(`${label} API error: ${msg}`);
            }
            console.log(`${label} done.`);
            return result;
        }
        if (status === "FAILED" || status === "ERROR") throw new Error(`${label} failed: ${JSON.stringify(data)}`);
    }
    throw new Error(`${label} timed out after ${maxSeconds}s`);
}

// ─── Helper: Submit to Fal queue and get URLs ────────────────────────────────
async function falQueue(endpoint: string, payload: object): Promise<{ statusUrl: string; resultUrl: string; requestId: string }> {
    const res = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`${endpoint} submit failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { statusUrl: data.status_url, resultUrl: data.response_url, requestId: data.request_id };
}

// ─── Transcription (Whisper) ─────────────────────────────────────────────────
async function transcribeWithWhisper(videoUrl: string): Promise<string> {
    console.log("Transcribing with Whisper...");
    const res = await fetch("https://fal.run/fal-ai/wizper", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: videoUrl, task: "transcribe", language: "en", chunk_level: "segment", version: "3" }),
    });
    if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const transcript = data.text?.trim();
    if (!transcript) throw new Error(`Whisper returned no transcript: ${JSON.stringify(data).slice(0, 200)}`);
    console.log("Transcript:", transcript.slice(0, 120));
    return transcript;
}

// ─── TTS: Preset voices via ChatterboxHD ────────────────────────────────────
async function ttsChatterbox(text: string, voiceId: string): Promise<string> {
    console.log("ChatterboxHD TTS:", voiceId);
    const res = await fetch("https://fal.run/resemble-ai/chatterboxhd/text-to-speech", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: voiceId }),
    });
    if (!res.ok) throw new Error(`ChatterboxHD TTS failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (data.audio?.url) return data.audio.url;
    throw new Error(`ChatterboxHD returned no audio: ${JSON.stringify(data).slice(0, 200)}`);
}

// ─── TTS: Cloned voices via MiniMax ─────────────────────────────────────────
async function ttsWithMinimax(text: string, minimaxVoiceId: string): Promise<string> {
    console.log("MiniMax TTS with voice_id:", minimaxVoiceId);
    const res = await fetch("https://fal.run/fal-ai/minimax/speech-02-hd", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            text,
            voice_setting: { voice_id: minimaxVoiceId, speed: 1.0, vol: 1.0, pitch: 0 },
            output_format: "url",
        }),
    });
    if (!res.ok) throw new Error(`MiniMax TTS failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (data.audio?.url) return data.audio.url;
    throw new Error(`MiniMax TTS returned no audio: ${JSON.stringify(data).slice(0, 200)}`);
}

// ─── Clone voice via MiniMax (or return cached ID) ───────────────────────────
async function getOrCloneMinimax(voiceId: string, refAudioUrl: string, supabaseAdmin: any): Promise<string> {
    // Check if we already have a cached minimax_voice_id for this voice
    const { data: voiceRow } = await supabaseAdmin
        .from("voices")
        .select("minimax_voice_id, name")
        .eq("id", voiceId)
        .single();

    if (voiceRow?.minimax_voice_id) {
        console.log("Reusing cached MiniMax voice_id:", voiceRow.minimax_voice_id);
        return voiceRow.minimax_voice_id;
    }

    // Clone the voice on MiniMax — costs $1.50 but gets cached for future uses
    const customVoiceId = `voice_${voiceId.replace(/-/g, "").slice(0, 20)}_${Date.now().toString(36)}`;
    console.log("Cloning voice on MiniMax, custom_voice_id:", customVoiceId);

    const res = await fetch("https://fal.run/fal-ai/minimax/voice-clone", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            audio_url: refAudioUrl,
            custom_voice_id: customVoiceId,
            noise_reduction: true,
            need_volume_normalization: true,
            text: "Testing this cloned voice.",
        }),
    });
    if (!res.ok) throw new Error(`MiniMax voice clone failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    console.log("MiniMax clone response:", JSON.stringify(data).slice(0, 200));

    const returnedVoiceId = data.custom_voice_id || customVoiceId;

    // Cache the minimax_voice_id in our DB so we don't clone again
    await supabaseAdmin.from("voices").update({ minimax_voice_id: returnedVoiceId }).eq("id", voiceId);
    console.log("Cached MiniMax voice_id:", returnedVoiceId);

    return returnedVoiceId;
}

// ─── Sync Lipsync ────────────────────────────────────────────────────────────
async function syncLipsync(videoUrl: string, audioUrl: string): Promise<string> {
    console.log("Sync Lipsync: merging audio + video with lip sync...");
    const { statusUrl, resultUrl } = await falQueue("fal-ai/sync-lipsync/v2/pro", {
        video_url: videoUrl,
        audio_url: audioUrl,
        sync_mode: "remap", // stretches/compresses audio to fit video duration
        model: "lipsync-2-pro",
    });
    const result = await falPoll(statusUrl, resultUrl, "Sync Lipsync", 240);
    const url = result.video?.url || result.video_url || result.url || result.output?.video?.url;
    if (!url) throw new Error(`Sync Lipsync returned no video URL: ${JSON.stringify(result).slice(0, 300)}`);
    return url;
}

// ─── Merge audio only (no lipsync) using local FFmpeg ───────────────────────
async function mergeAudioVideo(videoUrl: string, audioUrl: string): Promise<string> {
    console.log("Local FFmpeg merge (audio only)... restoring exact aspect ratio");

    const uniqueId = Date.now().toString(36);
    const videoPath = join(tmpdir(), `in_vid_${uniqueId}.mp4`);
    const musicPath = join(tmpdir(), `in_mus_${uniqueId}.mp3`);
    const outPath = join(tmpdir(), `out_${uniqueId}.mp4`);

    try {
        // Download Video
        const vidReq = await fetch(videoUrl);
        const vidBuffer = Buffer.from(await vidReq.arrayBuffer());
        await writeFile(videoPath, vidBuffer);

        // Download Audio
        const musReq = await fetch(audioUrl);
        const musBuffer = Buffer.from(await musReq.arrayBuffer());
        await writeFile(musicPath, musBuffer);

        // Run FFmpeg Mixing
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoPath)
                .input(musicPath)
                .outputOptions([
                    "-map 0:v",          // Original video
                    "-map 1:a",          // New audio
                    "-c:v copy",         // Exact bit-for-bit video copy (0 scaling/quality loss)
                    "-c:a aac",
                    "-b:a 192k",
                    "-shortest"
                ])
                .on("end", resolve)
                .on("error", reject)
                .save(outPath);
        });

        // Upload output file... wait! 
        // We need to return the URL or local file path?
        // Since `route.ts` expects a URL to download and THEN upload...
        // Let's just return the local file path and let the Route Handler handle local files!
        return outPath;
    } catch (e) {
        throw new Error(`FFmpeg local merge failed: ${e}`);
    } finally {
        // We'll clean up the input paths, leave the output path for the handler to upload
        try { await unlink(videoPath); } catch (e) { }
        try { await unlink(musicPath); } catch (e) { }
    }
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { videoUrl, mode, voiceId, refAudioUrl, script } = body;

        console.log("[replace-voice]", { mode, voiceId, refAudioUrl: refAudioUrl?.slice(0, 60), hasScript: !!script });

        if (!videoUrl) return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
        if (!voiceId) return NextResponse.json({ error: "voiceId is required" }, { status: 400 });
        if (!mode || (mode !== "s2s" && mode !== "voiceover")) {
            return NextResponse.json({ error: "mode must be 's2s' or 'voiceover'" }, { status: 400 });
        }

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Credits
        const COST = 15;
        const { data: profile } = await supabase.from("profiles").select("credits, role").eq("user_id", user.id).single();
        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
        if (!isAdmin && (profile?.credits ?? 0) < COST) {
            return NextResponse.json({ error: `You need at least ${COST} credits for this feature` }, { status: 403 });
        }

        const isPreset = !voiceId.includes("-"); // UUIDs have dashes

        // Admin Supabase client for DB writes
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        let ttsAudioUrl: string;
        let textToSpeak: string;

        if (mode === "s2s") {
            // Step 1: Transcribe what's being said in the video
            textToSpeak = await transcribeWithWhisper(videoUrl);
        } else {
            // Voiceover mode: user provided the script
            if (!script?.trim()) return NextResponse.json({ error: "A script is required for voiceover mode" }, { status: 400 });
            textToSpeak = script.trim();
        }

        // Step 2: Generate TTS with the selected voice
        if (isPreset) {
            // Preset voices — ChatterboxHD has great distinct voices
            ttsAudioUrl = await ttsChatterbox(textToSpeak, voiceId);
        } else {
            // Cloned voice — use MiniMax for high-quality voice cloning
            if (!refAudioUrl) return NextResponse.json({ error: "refAudioUrl is required for cloned voice" }, { status: 400 });
            const minimaxVoiceId = await getOrCloneMinimax(voiceId, refAudioUrl, admin);
            ttsAudioUrl = await ttsWithMinimax(textToSpeak, minimaxVoiceId);
        }

        // Step 3: Apply lip sync (Replace Voice mode) or simple merge (Voiceover mode)
        let finalVideoUrl: string;
        if (mode === "s2s") {
            finalVideoUrl = await syncLipsync(videoUrl, ttsAudioUrl);
        } else {
            finalVideoUrl = await mergeAudioVideo(videoUrl, ttsAudioUrl);
        }

        // Step 4: Download and re-upload to Supabase
        const BUCKET = process.env.NEXT_PUBLIC_GENERATIONS_BUCKET || "generations";
        const label = mode === "s2s" ? "lipsync" : "voiceover";
        const filePath = `videos/${user.id}/${label}_${Date.now()}.mp4`;

        let buffer: Buffer;
        if (finalVideoUrl.startsWith("http")) {
            // It's a URL (from Fal)
            const dlRes = await fetch(finalVideoUrl);
            buffer = Buffer.from(await dlRes.arrayBuffer());
        } else {
            // It's a local file path (from our local FFmpeg)
            const fs = require("fs");
            buffer = fs.readFileSync(finalVideoUrl);
            // Clean up the output temp file
            try { await unlink(finalVideoUrl); } catch (e) { }
        }

        const { error: uploadErr } = await admin.storage.from(BUCKET).upload(filePath, buffer, { contentType: "video/mp4", upsert: false });
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        const { data: pubData } = admin.storage.from(BUCKET).getPublicUrl(filePath);
        const savedUrl = pubData.publicUrl;

        // Step 5: Save to DB
        const { data: newRow, error: dbErr } = await admin.from("video_generations").insert({
            user_id: user.id,
            video_url: savedUrl,
            prompt: mode === "s2s" ? `[Voice Replace] ${textToSpeak.slice(0, 100)}` : `[Voiceover] ${textToSpeak.slice(0, 100)}`,
            status: "completed",
            is_public: true,
        }).select().single();

        if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

        // Deduct credits
        if (!isAdmin) {
            await admin.rpc("decrement_credits", { x: COST, user_id_param: user.id });
        }

        return NextResponse.json({ videoUrl: savedUrl, id: newRow?.id });

    } catch (e: any) {
        console.error("Replace Voice Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
