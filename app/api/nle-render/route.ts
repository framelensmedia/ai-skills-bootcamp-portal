import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min timeout for heavy renders

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export async function POST(req: Request) {
    try {
        const { tracks, duration } = await req.json();

        if (!tracks || !Array.isArray(tracks)) {
            return NextResponse.json({ error: "Invalid EDL payload." }, { status: 400 });
        }

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Admin Client for DB writes
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        // Credits Check (NLE uses 10 credits due to heavy composing)
        const COST = 10;
        const { data: profile } = await supabase.from("profiles").select("credits, role").eq("user_id", user.id).single();
        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

        if (!isAdmin && (profile?.credits ?? 0) < COST) {
            return NextResponse.json({ error: `You need at least ${COST} credits to render an NLE project.` }, { status: 403 });
        }

        const uniqueId = Date.now().toString(36);

        // 1. Gather & Download all assets
        console.log("Gathering assets for NLE render...");
        const assetMap = new Map<string, string>(); // url -> local /tmp/ path
        const allClips = tracks.flatMap(t =>
            (t.type === 'visual' ? !t.visible : t.muted) ? [] : t.clips
        );

        const dlPromises = allClips.map(async (clip, idx) => {
            if (!assetMap.has(clip.url)) {
                const ext = clip.mediaType === 'video' ? '.mp4' : clip.mediaType === 'image' ? '.png' : '.mp3';
                const localPath = join(tmpdir(), `nle_${uniqueId}_${idx}${ext}`);
                assetMap.set(clip.url, localPath);

                console.log(`Downloading ${clip.url} -> ${localPath}`);
                const res = await fetch(clip.url);
                const buf = Buffer.from(await res.arrayBuffer());
                await writeFile(localPath, buf);
            }
        });

        await Promise.all(dlPromises);

        // 2. Build the FFmpeg Command
        const outPath = join(tmpdir(), `nle_out_${uniqueId}.mp4`);
        const cmd = ffmpeg();

        // Setup base resolution (1920x1080) dummy background video to act as the canvas
        // This gives us a solid black frame to overlay everything onto, ensuring the exact `duration` is met.
        cmd.input(`color=c=black:s=1920x1080:d=${duration}`);
        cmd.inputFormat('lavfi');

        // Track inputs
        const inputs: string[] = []; // Sequential list of files passed to cmd.input()
        // `color` is input 0.

        let filterGraph: string[] = [];
        let videoOverlays = ["[0:v]"]; // Start with the black background
        let audioMixStreams: string[] = [];

        // Pre-register inputs to get their index
        allClips.forEach(clip => {
            const localPath = assetMap.get(clip.url)!;
            if (!inputs.includes(localPath)) {
                inputs.push(localPath);
                cmd.input(localPath);

                // If it's an image, tell ffmpeg to loop it as a video stream
                if (clip.mediaType === 'image') {
                    cmd.inputOptions(['-loop 1']);
                }
            }
        });

        // 3. Build Complex Filters
        allClips.forEach((clip, i) => {
            const inputIdx = inputs.indexOf(assetMap.get(clip.url)!) + 1; // +1 because 0 is the black bg
            const clipDur = clip.outPoint - clip.inPoint;

            // Generate unique tag names for this clip's streams
            const vOut = `v_${i}_out`;
            const aOut = `a_${i}_out`;

            if (clip.mediaType === 'video' || clip.mediaType === 'image') {
                // Video processing: Trim -> SetPTS (reset timestamp to 0) -> Scale (if needed) -> Format

                let vf = `[${inputIdx}:v]`;
                if (clip.mediaType === 'video') {
                    vf += `trim=start=${clip.inPoint}:end=${clip.outPoint},setpts=PTS-STARTPTS,`;
                } else {
                    // Image: just set duration
                    vf += `trim=duration=${clipDur},setpts=PTS-STARTPTS,`;
                }

                // Map percentages to 1920x1080 base
                const tw = clip.width ? `1920*${clip.width}/100` : `1920`;
                const th = clip.height ? `1080*${clip.height}/100` : `-1`; // maintain aspect

                vf += `scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=min(iw\\,1920):min(ih\\,1080)[${vOut}_pre]`;

                // Add to overlay stack. We use the previous overlay output, and overlay this clip at startTime.
                const prevOvl = videoOverlays[videoOverlays.length - 1];
                const nextOvl = `[ovl_${i}]`;

                const tx = clip.x ? `1920*${clip.x}/100` : `(W-w)/2`; // center by default
                const ty = clip.y ? `1080*${clip.y}/100` : `(H-h)/2`;

                filterGraph.push(vf);
                filterGraph.push(`${prevOvl}[${vOut}_pre]overlay=x=${tx}:y=${ty}:enable='between(t,${clip.startTime},${clip.startTime + clipDur})'${nextOvl}`);

                videoOverlays.push(nextOvl);

                // If video has audio, add it to audio mixing
                if (clip.mediaType === 'video') {
                    const adelayMs = Math.floor(clip.startTime * 1000);
                    filterGraph.push(`[${inputIdx}:a]atrim=start=${clip.inPoint}:end=${clip.outPoint},asetpts=PTS-STARTPTS,volume=${clip.volume},adelay=${adelayMs}|${adelayMs}[${aOut}]`);
                    audioMixStreams.push(`[${aOut}]`);
                }

            } else {
                // Audio / Voice Processing
                const adelayMs = Math.floor(clip.startTime * 1000);
                filterGraph.push(`[${inputIdx}:a]atrim=start=${clip.inPoint}:end=${clip.outPoint},asetpts=PTS-STARTPTS,volume=${clip.volume},adelay=${adelayMs}|${adelayMs}[${aOut}]`);
                audioMixStreams.push(`[${aOut}]`);
            }
        });

        // Mix all audio streams safely
        let finalAudio = "";
        if (audioMixStreams.length > 0) {
            filterGraph.push(`${audioMixStreams.join('')}amix=inputs=${audioMixStreams.length}:duration=longest:dropout_transition=3[final_a]`);
            finalAudio = "[final_a]";
        }

        const finalVideo = videoOverlays[videoOverlays.length - 1];

        console.log("Executing FFmpeg Filter Graph...");

        cmd.complexFilter(filterGraph);

        // Output mappings
        const outputOpts = [
            `-map ${finalVideo}`,
            `-c:v libx264`,
            `-preset veryfast`,
            `-t ${duration}`, // strict enforcement of timeline duration
            `-pix_fmt yuv420p`
        ];

        if (finalAudio) {
            outputOpts.push(`-map ${finalAudio}`);
            outputOpts.push(`-c:a aac`);
            outputOpts.push(`-b:a 192k`);
        }

        cmd.outputOptions(outputOpts);

        await new Promise((resolve, reject) => {
            cmd.on("start", (cmdline: string) => console.log("FFmpeg: ", cmdline))
                .on("end", resolve)
                .on("error", (err: any, stdout: any, stderr: any) => {
                    console.error("FFmpeg error:", err);
                    console.error(stderr);
                    reject(err);
                })
                .save(outPath);
        });

        console.log(`NLE Render complete. Uploading to storage...`);

        // Read output and upload
        const fs = require('fs');
        const outBuffer = fs.readFileSync(outPath);

        const bucketPath = `nle/${user.id}/${Date.now()}_project.mp4`;
        const { error: uploadErr } = await admin.storage
            .from("generations")
            .upload(bucketPath, outBuffer, { contentType: "video/mp4", upsert: false });

        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        const { data: pubData } = admin.storage.from("generations").getPublicUrl(bucketPath);
        const savedUrl = pubData.publicUrl;

        // Save to library
        const { data: newRow, error: dbErr } = await admin.from("video_generations").insert({
            user_id: user.id,
            video_url: savedUrl,
            prompt: `[Studio NLE Render] Timeline Composition`,
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
        await Promise.all(Array.from(assetMap.values()).map(p => cleanup(p)));
        await cleanup(outPath);

        return NextResponse.json({ videoUrl: savedUrl, id: newRow?.id });
    } catch (e: any) {
        console.error("NLE Render Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
