import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

const FAL_KEY = process.env.FAL_KEY!;
const COST = 30;

export async function POST(req: Request) {
    try {
        const { imageUrl, audioUrl } = await req.json();

        if (!imageUrl || !audioUrl) {
            return NextResponse.json({ error: "Image and Audio URLs are required" }, { status: 400 });
        }

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Admin check & Credits
        const adminAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: profile } = await adminAuth
            .from("profiles")
            .select("credits, role")
            .eq("user_id", user.id)
            .single();

        if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

        const isAdmin = ["admin", "super_admin"].includes(String(profile.role).toLowerCase());
        const credits = profile.credits ?? 0;

        if (!isAdmin && credits < COST) {
            return NextResponse.json({
                error: "Insufficient credits",
                required: COST,
                available: credits
            }, { status: 402 });
        }

        // Prepare payload for HeyGen Avatar 4 on Fal.ai
        const payload = {
            image_url: imageUrl,
            audio_url: audioUrl,
        };

        // Submit to fal queue
        const createRes = await fetch("https://queue.fal.run/fal-ai/heygen/avatar4/image-to-video", {
            method: "POST",
            headers: {
                Authorization: `Key ${FAL_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`HeyGen API error: ${createRes.status} ${errText}`);
        }

        const createData = await createRes.json();
        const statusUrl = createData.status_url;
        const resultUrl = createData.response_url;

        // Poll for completion
        let result: any;
        const maxRetries = 90; // Up to ~4.5 minutes
        for (let i = 0; i < maxRetries; i++) {
            await new Promise(r => setTimeout(r, 3000));
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
                throw new Error(`HeyGen generation failed: ${JSON.stringify(data.logs)}`);
            }
        }

        if (!result) throw new Error("Timed out waiting for generation.");

        const videoUrl = result.video?.url || result.url;
        if (!videoUrl) {
            throw new Error(`No video URL returned from HeyGen: ${JSON.stringify(result)}`);
        }

        // Upload to Supabase Storage (Optional but recommended for persistence)
        // For now, we'll return the Fal URL but ideally we should proxy/save it.
        // Let's proxy it to Supabase Storage like we did for Reference to Video.
        
        const videoRes = await fetch(videoUrl);
        if (!videoRes.ok) throw new Error(`Failed to fetch video from Fal: ${videoRes.status}`);
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

        const BUCKET = process.env.NEXT_PUBLIC_GENERATIONS_BUCKET || "generations";
        const filePath = `lipsync/${user.id}/${Date.now()}.mp4`;

        const { error: uploadError } = await adminAuth.storage
            .from(BUCKET)
            .upload(filePath, videoBuffer, { contentType: "video/mp4", upsert: false });
        
        if (uploadError) throw new Error(`Upload to storage failed: ${uploadError.message}`);

        const { data: pubUrl } = adminAuth.storage.from(BUCKET).getPublicUrl(filePath);
        const finalVideoUrl = pubUrl.publicUrl;

        // Save to DB
        await adminAuth.from("video_generations").insert({
            user_id: user.id,
            video_url: finalVideoUrl,
            prompt: "Lip Sync (HeyGen Avatar 4)",
            status: "completed",
            is_public: true,
        });

        // Deduct credits
        if (!isAdmin) {
            await adminAuth.rpc("decrement_credits", { x: COST, user_id_param: user.id });
        }

        return NextResponse.json({ videoUrl: finalVideoUrl, remainingCredits: credits - COST });
    } catch (e: any) {
        console.error("Lip Sync Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
