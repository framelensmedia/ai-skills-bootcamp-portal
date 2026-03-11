import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const maxDuration = 300;
export const runtime = "nodejs";

const COST = 20;

export async function POST(req: Request) {
    try {
        const { imageUrl, videoUrl, prompt } = await req.json();

        if (!imageUrl || !videoUrl) {
            return NextResponse.json({ error: "Image URL and Video URL are required" }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Check Credits
        const { data: profile } = await supabase.from("profiles").select("credits, role").eq("user_id", user.id).single();

        const role = String(profile?.role || "").toLowerCase();
        const isAdmin = role === "admin" || role === "super_admin";

        if (!isAdmin && (!profile || profile.credits < COST)) {
            return NextResponse.json({ error: "Insufficient credits" }, { status: 403 });
        }

        console.log("Submitting to Kling v3 Motion Control...");

        const falToken = process.env.FAL_KEY;
        const submitRes = await fetch("https://queue.fal.run/fal-ai/kling-video/v3/standard/motion-control", {
            method: "POST",
            headers: {
                "Authorization": `Key ${falToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                image_url: imageUrl,
                video_url: videoUrl,
                prompt: prompt || "best quality, cinematic lighting"
            })
        });

        const initialJson = await submitRes.json();

        if (!submitRes.ok) {
            throw new Error(initialJson.error || initialJson.detail?.[0]?.msg || "Failed to submit queue to Fal.ai Kling");
        }

        const request_id = initialJson.request_id;
        console.log("Kling Request queued:", request_id);

        // Store a pending record in our database to track it while it generates async
        const { error: insertErr } = await supabase
            .from("video_generations")
            .insert({
                user_id: user.id,
                generation_id: request_id,
                prompt: prompt || "Kling v3 Motion Transfer",
                video_url: null, // Pending
                source_image_url: imageUrl,
                source_video_url: videoUrl,
                model: "fal-ai/kling-video/v3/standard/motion-control",
                status: "pending"
            });

        if (insertErr) {
            console.error("Supabase insert error:", insertErr);
        }

        // Deduct credits immediately
        let newCredits = profile?.credits ?? 0;
        if (!isAdmin) {
            const { error: creditErr } = await supabase.rpc('decrement_credits', {
                user_id_param: user.id,
                amount: COST
            });
            if (creditErr) console.error("Credit deduction error:", creditErr);
            else newCredits -= COST;
        }

        return NextResponse.json({
            status: "pending",
            generationId: request_id,
            remainingCredits: newCredits
        }, { status: 202 });

    } catch (error: any) {
        console.error("Kling API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate Kling motion" }, { status: 500 });
    }
}
