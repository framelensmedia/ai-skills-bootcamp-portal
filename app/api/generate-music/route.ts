import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120; // Sonauto takes around 30-60s to generate

const FAL_KEY = process.env.FAL_KEY!;

export async function POST(req: Request) {
    try {
        const { prompt, lyrics } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: "prompt is required" }, { status: 400 });
        }

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Check Credits
        const COST = 10;
        const { data: profile } = await supabase.from("profiles").select("credits, role").eq("user_id", user.id).single();
        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

        if (!isAdmin && (profile?.credits ?? 0) < COST) {
            return NextResponse.json({ error: `You need at least ${COST} credits for Music Studio` }, { status: 403 });
        }

        // 1. Generate Music with Fal.ai MiniMax Music v2
        // Generate Music via Fal queue
        console.log(`Generating music for prompt: "${prompt}"`);
        const createRes = await fetch("https://queue.fal.run/fal-ai/minimax-music/v2", {
            method: "POST",
            headers: {
                Authorization: `Key ${FAL_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt,
                lyrics_prompt: lyrics || "[instrumental background track]" // Minimum 10 characters required
            }),
        });

        if (!createRes.ok) {
            throw new Error(`MiniMax API error: ${createRes.status} ${await createRes.text()}`);
        }

        const createData = await createRes.json();
        const statusUrl = createData.status_url;
        const resultUrl = createData.response_url;

        // Poll for completion
        let result: any;
        for (let i = 0; i < 90; i++) { // Minimax can take 2-3 minutes
            await new Promise(r => setTimeout(r, 2000));
            const st = await fetch(statusUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
            const data = await st.json();

            if (data.status === "COMPLETED") {
                const res = await fetch(resultUrl, { headers: { Authorization: `Key ${FAL_KEY}` } });
                result = await res.json();
                break;
            }
            if (data.status === "FAILED") {
                throw new Error("Music generation failed");
            }
        }

        if (!result) throw new Error("Timed out waiting for music generation");

        const audioUrl = result.audio_file?.url || result.audio?.url || result.url;

        if (!audioUrl) {
            throw new Error(`MiniMax API returned no audio URL: ${JSON.stringify(result).slice(0, 200)}`);
        }

        console.log("Generated MiniMax audio URL:", audioUrl);

        // Admin Supabase client for DB writes
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        // 2. Download and re-upload to our Storage
        const filePath = `${user.id}/${Date.now()}.mp3`;

        const dlRes = await fetch(audioUrl);
        const buffer = Buffer.from(await dlRes.arrayBuffer());

        const { error: uploadErr } = await admin.storage
            .from("music")
            .upload(filePath, buffer, { contentType: "audio/mpeg", upsert: false });

        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

        const { data: pubData } = admin.storage.from("music").getPublicUrl(filePath);
        const savedUrl = pubData.publicUrl;

        // 3. Save to DB
        const { data: newRow, error: dbErr } = await admin.from("music_generations").insert({
            user_id: user.id,
            audio_url: savedUrl,
            prompt: prompt,
        }).select().single();

        if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

        // 4. Deduct credits
        if (!isAdmin) {
            await admin.rpc("decrement_credits", { x: COST, user_id_param: user.id });
        }

        return NextResponse.json({ audioUrl: savedUrl, id: newRow?.id });

    } catch (e: any) {
        console.error("Generate Music Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
