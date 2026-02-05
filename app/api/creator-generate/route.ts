
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

async function generateFalImage(
    modelId: string,
    prompt: string,
    imageSize: any,
    mainImageUrl?: string | null,
    template_reference_image?: string | null,
    keepOutfit: boolean = false,
    negativePrompt?: string
) {
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("Missing FAL_KEY env var");

    const endpoint = `https://queue.fal.run/${modelId}`;

    const payload: any = {
        prompt,
        image_size: imageSize,
        safety_tolerance: "2",
        negative_prompt: negativePrompt || "cartoon, illustration, animation, face distortion, strange anatomy, disfigured, bad art, blurry, pixelated"
    };

    // Strength Tuning
    if (mainImageUrl) {
        payload.strength = keepOutfit ? 0.85 : 0.70;
    }

    // Ratio Fallback
    if (typeof imageSize === 'string' && imageSize.includes('16_9')) payload.aspect_ratio = "16:9";
    if (typeof imageSize === 'string' && imageSize.includes('9_16')) payload.aspect_ratio = "9:16";
    if (typeof imageSize === 'string' && imageSize.includes('square')) payload.aspect_ratio = "1:1";

    const isNanoBanana = modelId.includes("nano-banana");

    if (isNanoBanana) {
        // Nano Banana Pro Logic
        if (template_reference_image) {
            // Remix Mode
            payload.image_urls = [template_reference_image];
            if (mainImageUrl && mainImageUrl !== template_reference_image) {
                payload.image_urls.push(mainImageUrl);
            }
            if (mainImageUrl) {
                payload.strength = 0.95;
            }
        } else {
            // Direct Edit / Selfie Mode
            if (mainImageUrl) payload.image_url = mainImageUrl;
            payload.image_urls = [];
            payload.strength = 0.75;
        }

        // Force 9:16 for Remixes if not square
        if (!payload.aspect_ratio) {
            if (imageSize === "portrait_16_9") payload.aspect_ratio = "9:16";
            else if (imageSize === "landscape_16_9") payload.aspect_ratio = "16:9";
        }
    } else {
        // Fallback for other models
        if (mainImageUrl) payload.image_url = mainImageUrl;
    }

    // Use /edit endpoint if image provided
    const actualEndpoint = isNanoBanana && (payload.image_url || payload.image_urls?.length)
        ? `https://queue.fal.run/${modelId}/edit`
        : endpoint;

    console.log(`CREATOR GEN (${modelId}):`, {
        prompt: prompt.slice(0, 50),
        endpoint: actualEndpoint
    });

    // 1. Submit Request
    const res = await fetch(actualEndpoint, {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Fal.ai Request Failed: ${res.status} ${err}`);
    }

    const initialJson = await res.json();

    // Check for direct completion (Sync response)
    if (initialJson.images?.[0]?.url) {
        console.log("CREATOR GEN: Sync Response");
        return initialJson.images[0].url;
    }

    const request_id = initialJson.request_id;
    if (!request_id) {
        throw new Error(`Fal.ai returned no request_id and no images: ${JSON.stringify(initialJson)}`);
    }

    // 2. Poll
    const startTime = Date.now();
    const TIMEOUT_MS = 290000; // 290s

    while (Date.now() - startTime < TIMEOUT_MS) {
        await new Promise(r => setTimeout(r, 1000));

        const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${request_id}`, {
            headers: {
                "Authorization": `Key ${falKey}`,
            },
        });

        if (!statusRes.ok) continue;

        const statusJson = await statusRes.json();

        if (statusJson.images?.[0]?.url) {
            return statusJson.images[0].url;
        }

        if (statusJson.status === "COMPLETED") {
            const imageUrl = statusJson.images?.[0]?.url;
            if (!imageUrl) throw new Error("Fal.ai completed but returned no image URL");
            return imageUrl;
        }

        if (statusJson.status === "IN_QUEUE" || statusJson.status === "IN_PROGRESS") {
            continue;
        }

        throw new Error(`Fal.ai Generation Failed: ${JSON.stringify(statusJson)}`);
    }

    throw new Error("Fal.ai Generation Timed Out");
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 1. Extract Payload
        const {
            prompt,
            userId,
            aspectRatio = "9:16",
            imageUrls = [],
            subjectLock,
            keepOutfit,
            template_reference_image,
            headline, subheadline, cta, promotion, business_name
        } = body;

        if (!prompt || !userId) return NextResponse.json({ error: "Missing prompt or user" }, { status: 400 });

        // 2. Check Credits
        const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
        const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
        const admin = createClient(supabaseUrl, serviceRole);

        const { data: userProfile, error: profileErr } = await admin
            .from("profiles")
            .select("credits, role")
            .eq("user_id", userId)
            .single();

        if (profileErr || !userProfile) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        const isAdmin = userProfile.role === "admin" || userProfile.role === "super_admin";
        const IMAGE_COST = 3;

        if (!isAdmin && (userProfile.credits ?? 0) < IMAGE_COST) {
            return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
        }

        // 3. Prepare Prompt Engine
        let finalPrompt = prompt;
        let subjectInstruction = "";
        let remixNegativePrompt: string | undefined;

        // Force Nano Banana Pro mapping
        const model = "fal-ai/nano-banana-pro";

        let falImageSize: any = { width: 832, height: 1216 }; // Default 9:16
        if (aspectRatio === "16:9") falImageSize = { width: 1216, height: 832 };
        if (aspectRatio === "1:1") falImageSize = { width: 1024, height: 1024 };

        const refImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

        // Subject Lock Logic
        if (refImageUrl && (subjectLock === "true" || subjectLock === true)) {
            const isNano = true;

            // DETECT REMIX MODE (Template + Subject)
            if (isNano && template_reference_image && refImageUrl !== template_reference_image) {
                // CLASSIC REMIX INSTRUCTION
                subjectInstruction += " [SUBJECT REPLACEMENT MODE - STRICT LAYOUT LOCK] ";
                subjectInstruction += " 1. TASK: Replace the person in the Base Image (Image 1) with the Subject from the Reference Image (Image 2). ";
                subjectInstruction += " 2. SCALE LOCK: Resize the Reference Face/Body to fit the EXACT proportions of the Base Image. Do NOT zoom in. Do NOT let the subject fill the screen. ";
                subjectInstruction += " 3. TEXT SAFETY: The Base Image contains text at the top and bottom. YOU MUST NOT COVER IT. Keep the subject's head below the top margin. ";
                subjectInstruction += " 4. LIKENESS: The face must match the Reference Image (Image 2) exactly. Maintain the exact eye line, gaze, and facial expression. ";
                subjectInstruction += " 5. ANATOMY: Ensure the neck transition is natural. Do not squash the head. ";
                subjectInstruction += " 6. CAMERA: Match the lighting, depth of field, and camera angle of the Base Image. ";

                remixNegativePrompt = "close up, extreme close up, zooming in, face filling screen, covering text, blocking text, text overlay, cartoon, illustration, 3d render, plastic, fake, distorted face, bad anatomy, ghosting, double exposure, blurry, pixelated, low resolution, bad lighting, makeup, face paint";

                if (keepOutfit === "true" || keepOutfit === true) {
                    subjectInstruction += " OUTFIT: Keep the Subject's original outfit (from Image 2). ";
                } else {
                    subjectInstruction += " OUTFIT: The Subject is wearing the EXACT outfit shown in the Base Image (Image 1). Use the clothing from the Base Image. ";
                }

            } else {
                // STANDARD / GENERIC LOGIC
                if (keepOutfit === "true" || keepOutfit === true) {
                    subjectInstruction += " PRESERVE OUTFIT: Keep the subject's clothing exactly as it is in the reference image. ";
                } else {
                    subjectInstruction += " CHANGE OUTFIT: The subject must wear a COMPLETELY NEW OUTFIT that fits the context of the scene. Do NOT use the clothing from the reference image. ";
                }
                subjectInstruction += " FACE LOCK: Maintain the exact eye line, camera angle, and facial identity of the subject. ";
            }

            finalPrompt = subjectInstruction + finalPrompt;
        } else {
            // Clean up prompt if no subject lock
            finalPrompt += ", shot on Canon 5D Mk IV, 85mm lens, f/1.8, sharp focus, cinematic lighting, photorealistic, hyper-realistic, 8k, master photography";
        }

        // Text Replacement Logic
        if (headline || subheadline || cta || promotion || business_name) {
            let textPrompt = " [TEXT REPLACEMENT MANDATE]: You must REPLACE the text in the original image with the new text provided below. Do NOT render the original text. ";
            textPrompt += " Render the new text clearly and professionally, maintaining the original layout style where possible but adapting to the new length. ";

            if (headline) textPrompt += `Headline: "${headline}". `;
            if (subheadline) textPrompt += `Subhead: "${subheadline}". `;
            if (cta) textPrompt += `Button/CTA: "${cta}". `;
            if (promotion) textPrompt += `Offer: "${promotion}". `;
            if (business_name) textPrompt += `Business Name: "${business_name}". `;
            textPrompt += "Typography must be legible, sharp, and integrated into the scene. ";

            finalPrompt += textPrompt;
        }

        // 4. Generate
        const imageUrl = await generateFalImage(model, finalPrompt, falImageSize, refImageUrl, template_reference_image, keepOutfit === "true", remixNegativePrompt);

        // 5. Save & Deduct
        const { data: inserted } = await admin.from("prompt_generations").insert({
            user_id: userId,
            image_url: imageUrl,
            combined_prompt_text: finalPrompt,
            settings: { model, provider: "fal-creator" }
        }).select().single();

        if (!isAdmin) {
            await admin.rpc("decrement_credits", { x: IMAGE_COST, user_id_param: userId });
        }

        return NextResponse.json({
            images: [{ url: imageUrl }],
            generationId: inserted?.id || "temp",
            imageUrl
        });

    } catch (e: any) {
        console.error("Creator Gen Error:", e);
        return NextResponse.json({ error: e.message || "Generation Failed" }, { status: 500 });
    }
}
