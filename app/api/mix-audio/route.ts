import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const maxDuration = 300;

// Set the ffmpeg path from the installer
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(req: Request) {
    try {
        const { videoUrl, musicUrl, videoVolume = 1.0, musicVolume = 0.5 } = await req.json();

        if (!videoUrl || !musicUrl) {
            return NextResponse.json({ error: "videoUrl and musicUrl are required" }, { status: 400 });
        }

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Admin Client for DB writes
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        // Credits Check
        const COST = 5;
        const { data: profile } = await supabase.from("profiles").select("credits, role").eq("user_id", user.id).single();
        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

        if (!isAdmin && (profile?.credits ?? 0) < COST) {
            return NextResponse.json({ error: `You need at least ${COST} credits for rendering.` }, { status: 403 });
        }

        const uniqueId = Date.now().toString(36);
        const videoPath = join(tmpdir(), `in_vid_${uniqueId}.mp4`);
        const musicPath = join(tmpdir(), `in_mus_${uniqueId}.mp3`);
        const outPath = join(tmpdir(), `out_${uniqueId}.mp4`);

        console.log(`Downloading assets for mixing...`);
        // Download Video
        const vidReq = await fetch(videoUrl);
        const vidBuffer = Buffer.from(await vidReq.arrayBuffer());
        await writeFile(videoPath, vidBuffer);

        // Download Music
        const musReq = await fetch(musicUrl);
        const musBuffer = Buffer.from(await musReq.arrayBuffer());
        await writeFile(musicPath, musBuffer);

        console.log(`Mixing audio with videoVolume=${videoVolume}, musicVolume=${musicVolume}`);

        // Run FFmpeg Mixing
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoPath)
                .input(musicPath)
                .complexFilter([
                    // Adjust volumes
                    `[0:a]volume=${videoVolume}[v_aud]`,
                    `[1:a]volume=${musicVolume}[m_aud]`,
                    // Mix them together: duration=first ensures it ends when the video ends
                    `[v_aud][m_aud]amix=inputs=2:duration=first:dropout_transition=3[out_a]`
                ])
                .outputOptions([
                    "-map 0:v",          // Take video stream from first input
                    "-map [out_a]",      // Take mixed audio stream
                    "-c:v copy",         // Copy video stream without re-encoding (FAST)
                    "-c:a aac",          // Encode audio to AAC
                    "-b:a 192k",         // Good audio quality
                    "-shortest"          // Just in case, stop when shortest stream ends
                ])
                .on("end", resolve)
                .on("error", (err) => {
                    console.error("FFmpeg error:", err);
                    reject(err);
                })
                .save(outPath);
        });

        console.log(`Mixing complete. Uploading to storage...`);

        // Read output and upload
        const fs = require('fs');
        const outBuffer = fs.readFileSync(outPath);

        const bucketPath = `editors/${user.id}/${Date.now()}_mixed.mp4`;
        const { error: uploadErr } = await admin.storage
            .from("generations")
            .upload(bucketPath, outBuffer, { contentType: "video/mp4", upsert: false });

        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        const { data: pubData } = admin.storage.from("generations").getPublicUrl(bucketPath);
        const savedUrl = pubData.publicUrl;

        // Save to generations library
        const { data: newRow, error: dbErr } = await admin.from("video_generations").insert({
            user_id: user.id,
            video_url: savedUrl,
            prompt: `[Mixed Audio Render]`,
            status: "completed",
            is_public: true,
        }).select().single();

        if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

        // Deduct credits
        if (!isAdmin) {
            await admin.rpc("decrement_credits", { x: COST, user_id_param: user.id });
        }

        // Cleanup temp files
        const cleanup = async (p: string) => { try { await unlink(p); } catch (e) { } };
        await cleanup(videoPath);
        await cleanup(musicPath);
        await cleanup(outPath);

        return NextResponse.json({ videoUrl: savedUrl, id: newRow?.id });
    } catch (e: any) {
        console.error("Mix Audio Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
