import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { frontUrl, leftUrl, rightUrl, fullBodyUrl, characterName, description } = body;

        if (!frontUrl || !leftUrl || !rightUrl) {
            return NextResponse.json({ error: "Front, left and right view photos are required." }, { status: 400 });
        }

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const adminAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Check credits (costs same as a normal image = 3)
        const IMAGE_COST = 3;
        const { data: profile } = await adminAuth.from("profiles").select("credits, role").eq("user_id", user.id).single();
        const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";
        const credits = profile?.credits ?? 0;

        if (!isAdmin && credits < IMAGE_COST) {
            return NextResponse.json({ error: `Insufficient credits. Need ${IMAGE_COST}, have ${credits}.` }, { status: 402 });
        }

        // Build the character sheet prompt
        const nameStr = characterName ? `Character name: ${characterName}. ` : "";
        const notesStr = description ? `Additional notes: ${description}. ` : "";
        const viewsStr = fullBodyUrl
            ? "FRONT VIEW (top center), LEFT PROFILE (top left), RIGHT PROFILE (top right), FULL BODY (bottom center)"
            : "FRONT VIEW (center), LEFT PROFILE (left), RIGHT PROFILE (right)";

        const prompt = [
            `[CHARACTER SHEET] Professional multi-view character reference sheet.`,
            `${nameStr}${notesStr}`,
            `Clean grid layout showing: ${viewsStr}.`,
            `White or light grey gradient background. Crisp studio lighting. Each view clearly labeled in small tasteful type.`,
            `Exact likeness preservation — same skin tone, facial structure, and features across all views.`,
            `Character design reference sheet style. High detail. Professional production quality.`,
        ].join(" ").trim();

        // Build image reference array — pass all views as reference images
        const imageUrls = [frontUrl, leftUrl, rightUrl, ...(fullBodyUrl ? [fullBodyUrl] : [])];

        // Call the existing creator-generate endpoint internally
        const generateRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/creator-generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt,
                userId: user.id,
                aspectRatio: "1:1",
                imageUrls,
                subjectLock: "true",
                forceCutout: "false",
                subjectMode: "human",
                keepOutfit: "false",
            }),
        });

        let genData: any;
        if (!generateRes.ok) {
            const errText = await generateRes.text();
            console.error("[CharacterSheet] creator-generate error:", errText);
            return NextResponse.json({ error: "Image generation failed. Please try again." }, { status: 500 });
        }
        genData = await generateRes.json();

        const imageUrl = genData.full_quality_url || genData.imageUrl;
        if (!imageUrl) {
            return NextResponse.json({ error: "No image returned from generator." }, { status: 500 });
        }

        // Deduct credits
        if (!isAdmin) {
            try {
                await adminAuth.rpc("decrement_credits", { x: IMAGE_COST, user_id_param: user.id });
            } catch {
                await adminAuth.from("profiles").update({ credits: credits - IMAGE_COST }).eq("user_id", user.id);
            }
        }

        return NextResponse.json({
            imageUrl,
            generationId: genData.generationId,
            remainingCredits: isAdmin ? null : credits - IMAGE_COST,
        });

    } catch (err: any) {
        console.error("[CharacterSheet] Error:", err);
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}
