
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getBusinessContext } from "@/lib/businessContext"; // Agentic

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
    strength?: number,
    negativePrompt?: string
) {
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("Missing FAL_KEY env var");

    const endpoint = `https://queue.fal.run/${modelId}`;

    const payload: any = {
        prompt,
        image_size: imageSize,
        // No safety_tolerance, no negative_prompt override
    };

    // Ratio Fallback
    if (typeof imageSize === 'string') {
        if (imageSize.includes('16_9') || imageSize.includes('landscape')) payload.aspect_ratio = "16:9";
        else if (imageSize.includes('9_16') || imageSize.includes('portrait')) payload.aspect_ratio = "9:16";
        else if (imageSize.includes('square') || imageSize.includes('1_1')) payload.aspect_ratio = "1:1";
        else if (imageSize.includes('4_3')) payload.aspect_ratio = "4:3";
        else if (imageSize.includes('3_4')) payload.aspect_ratio = "3:4";
    } else if (imageSize && typeof imageSize === 'object') {
        if (imageSize.width > imageSize.height) payload.aspect_ratio = "16:9";
        else if (imageSize.width === imageSize.height) payload.aspect_ratio = "1:1";
        else if (imageSize.width === 832 && imageSize.height === 1024) payload.aspect_ratio = "4:5";
        else payload.aspect_ratio = "9:16";
    }

    const isNanoBanana = modelId.includes("nano-banana");

    if (isNanoBanana) {
        // Nano Banana Pro Logic
        if (template_reference_image) {
            // Remix Mode: Base = Template, Ref = Subject
            // CRITICAL FIX: The base canvas must be the TEMPLATE, not the Selfie.
            payload.image_url = template_reference_image;

            // The reference is the Subject (Main Image)
            // We do NOT include the template in image_urls, as it is already the base.
            if (mainImageUrl && mainImageUrl !== template_reference_image) {
                payload.image_urls = [mainImageUrl];
            } else {
                payload.image_urls = []; // Fallback (shouldn't happen in remix)
            }


        } else {
            // Direct Edit / Selfie Mode
            // Here, the Selfie IS the base.
            if (mainImageUrl) {
                payload.image_url = mainImageUrl;
                payload.image_urls = [mainImageUrl]; // REQUIRED: Matches input for single image
            } else {
                payload.image_urls = [];
            }
            // Use passed strength or default
            payload.strength = strength || 0.75;
        }

        // Apply override if provided (covers Remix case too)
        if (strength) payload.strength = strength;

        // Force 9:16 for Remixes if not square
        if (!payload.aspect_ratio) {
            payload.aspect_ratio = "9:16"; // Default
        }
    } else {
        if (mainImageUrl) payload.image_url = mainImageUrl;
    }

    // Use /edit endpoint if image provided
    const actualEndpoint = isNanoBanana && payload.image_url
        ? `https://queue.fal.run/${modelId}/edit`
        : endpoint;

    console.log(`CREATOR GEN (${modelId}):`, {
        prompt: prompt.slice(0, 50),
        endpoint: actualEndpoint,
        payload: JSON.stringify(payload)
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
    console.log("CREATOR GEN: Initial Response:", JSON.stringify(initialJson));

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
    let attempts = 0;

    while (Date.now() - startTime < TIMEOUT_MS) {
        attempts++;
        await new Promise(r => setTimeout(r, 2000));

        const statusUrl = `https://queue.fal.run/${modelId}/requests/${request_id}`;
        const statusRes = await fetch(statusUrl, {
            headers: {
                "Authorization": `Key ${falKey}`,
            },
        });

        if (!statusRes.ok) {
            const errText = await statusRes.text();
            console.warn(`Attempt ${attempts}: Status Check Failed (${statusRes.status}) - URL: ${statusUrl} - Err: ${errText}`);
            continue;
        }

        const statusJson = await statusRes.json();
        console.log(`Attempt ${attempts}: Status=${statusJson.status}`);

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

        console.error("Unknown Status:", JSON.stringify(statusJson));
        throw new Error(`Fal.ai Generation Failed: ${JSON.stringify(statusJson)}`);
    }

    console.error("TIMEOUT REACHED. Last known status:", attempts);
    throw new Error("Fal.ai Generation Timed Out (Backend 290s limit)");
}

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get("content-type") || "";

        let prompt = "";
        let userId = "";
        let aspectRatio = "9:16";
        let subjectOutfit = "";
        let keepOutfit = true;
        let subjectLock = false;
        let forceCutout = false;
        let template_reference_image: string | null = null;
        let subjectMode = "non_human";
        let requestedModel: string | null = null;

        // Text fields
        let headline: string | null = null;
        let subheadline: string | null = null;
        let cta: string | null = null;
        let promotion: string | null = null;
        let business_name: string | null = null;
        let industry_intent: string | null = null;
        let instructions: string | null = null;

        // Images
        let imageFiles: File[] = [];
        let imageUrls: string[] = [];
        let logoFile: File | null = null;
        let logoUrl: string | null = null;

        // 1. Parse Input (FormData or JSON)
        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();

            prompt = formData.get("prompt") as string;
            userId = formData.get("userId") as string;
            aspectRatio = formData.get("aspectRatio") as string || "9:16";
            subjectOutfit = formData.get("subjectOutfit") as string;
            keepOutfit = formData.get("keepOutfit") === "true"; // Parse string "true"
            subjectLock = formData.get("subjectLock") === "true";
            subjectMode = formData.get("subjectMode") as string || "non_human";
            forceCutout = formData.get("forceCutout") === "true";
            requestedModel = formData.get("modelId") as string;

            template_reference_image = formData.get("template_reference_image") as string;

            headline = formData.get("headline") as string;
            subheadline = formData.get("subheadline") as string;
            cta = formData.get("cta") as string;
            promotion = formData.get("promotion") as string;
            business_name = formData.get("business_name") as string;
            industry_intent = formData.get("industry_intent") as string;
            instructions = formData.get("instructions") as string;

            imageFiles = formData.getAll("image") as File[];
            logoFile = formData.get("logo_image") as File | null;

        } else {
            // JSON Handling (Fixes Payload Size Limit)
            const body = await req.json();

            prompt = body.prompt;
            userId = body.userId;
            aspectRatio = body.aspectRatio || "9:16";
            subjectOutfit = body.subjectOutfit;
            keepOutfit = body.keepOutfit === "true" || body.keepOutfit === true;
            subjectLock = body.subjectLock === "true" || body.subjectLock === true;
            subjectMode = body.subjectMode || "non_human";
            forceCutout = body.forceCutout === "true" || body.forceCutout === true;
            requestedModel = body.modelId;

            template_reference_image = body.template_reference_image;

            headline = body.headline;
            subheadline = body.subheadline;
            cta = body.cta;
            promotion = body.promotion;
            business_name = body.business_name;
            industry_intent = body.industry_intent;
            instructions = body.instructions;

            // Image URLs from staged uploads
            if (Array.isArray(body.imageUrls)) {
                imageUrls = body.imageUrls.map(String);
            }
            // Logo URL
            logoUrl = body.logo_image;
        }

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

        // 3. Handle Image Uploads (Server Side fallback for FormData)
        if (imageFiles.length > 0) {
            const firstFile = imageFiles[0];
            const ab = await firstFile.arrayBuffer();
            const buffer = Buffer.from(ab);
            const filePath = `fal-uploads/${userId}/${Date.now()}.jpg`;

            const { error: uploadErr } = await admin.storage
                .from("generations")
                .upload(filePath, buffer, { contentType: firstFile.type || "image/jpeg", upsert: false });

            if (!uploadErr) {
                const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
                imageUrls.push(pubUrl.publicUrl);
            } else {
                console.warn("Failed to upload reference image for Fal:", uploadErr);
            }
        }

        // Handle Logo Upload (Server Side fallback)
        if (logoFile) {
            const ab = await logoFile.arrayBuffer();
            const buffer = Buffer.from(ab);
            const filePath = `fal-uploads/${userId}/logo-${Date.now()}.png`;
            const { error: uploadErr } = await admin.storage
                .from("generations")
                .upload(filePath, buffer, { contentType: logoFile.type || "image/png", upsert: false });

            if (!uploadErr) {
                const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
                logoUrl = pubUrl.publicUrl;
            }
        }

        // 3. Prepare Prompt Engine
        let finalPrompt = prompt;
        let subjectInstruction = "";
        let remixNegativePrompt: string | undefined;

        // Force Nano Banana Pro mapping - ensure fal-ai/ prefix is present
        let model = requestedModel || "fal-ai/nano-banana-pro";
        if (model === "nano-banana-pro") model = "fal-ai/nano-banana-pro";
        const isNano = model.includes("nano-banana");

        let falImageSize: any = { width: 832, height: 1216 }; // Default 9:16
        if (aspectRatio === "16:9") falImageSize = { width: 1216, height: 832 };
        else if (aspectRatio === "1:1") falImageSize = { width: 1024, height: 1024 };
        else if (aspectRatio === "4:5") falImageSize = { width: 832, height: 1024 };

        const refImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

        // Subject Lock Logic
        if (refImageUrl && subjectLock) {
            // DETECT REMIX MODE (Template + Subject)
            if (template_reference_image && refImageUrl !== template_reference_image) {
                // CLASSIC REMIX INSTRUCTION
                subjectInstruction += " [SUBJECT REPLACEMENT MODE - STRICT LAYOUT LOCK] ";
                subjectInstruction += " 1. TASK: Face Swap. Replace the face of the person in Image 1 (Template) with the face of the Subject from Image 2. ";
                subjectInstruction += " 2. PRESERVE DETAILS: Keep Image 1's exact background, text, and PROPS. If the person in Image 1 is holding something (like a drink, phone, or object), they MUST keep holding it. ";
                subjectInstruction += " 3. SCALE & FIT: The subject's body must be the SAME SIZE as the original person in Image 1. Match the exact head size, body proportions, and position. The subject must fit naturally within the scene—do NOT enlarge or zoom in on the subject. ";
                subjectInstruction += " 4. LIKENESS: The face must match Image 2 exactly. IGNORE the facial features of Image 1. The face should be 100% the person from Image 2. ";
                subjectInstruction += " 5. [FACE IDENTITY LOCK]: DO NOT blend, mix, or morph the face. COPY the face from Image 2 directly. ";

                remixNegativePrompt = "enlarged subject, oversized person, zoomed in, face morphing, morphed face, mixed identity, blended faces, different person, wrong person, old face, missing props, missing drink, empty hands, covering text, blocking text, text overlay, missing text, blurred text, distorted text, wrong letters, cartoon, illustration, 3d render, plastic, fake, distorted face, bad anatomy, ghosting";

                if (subjectOutfit && subjectOutfit.trim().length > 0) {
                    subjectInstruction += ` OUTFIT: The subject is wearing ${subjectOutfit}. REWRITE the body to match this outfit description. `;
                } else {
                    // Default to keeping the same clothes - uses same pattern as typed outfit
                    subjectInstruction += " OUTFIT: The subject is wearing the same clothes from Image 1. REWRITE the body to match the exact clothing from Image 1. ";
                }
                subjectInstruction += " [PROP LOCK]: IF the person in Image 1 is holding something (drink, phone, etc), the subject MUST still be holding it. Do NOT remove props from their hands. ";

            } else {
                // STANDARD / GENERIC LOGIC
                // (kept for backward compatibility or direct edit modes)
                if (subjectOutfit && subjectOutfit.trim().length > 0) {
                    subjectInstruction += ` OUTFIT: The subject is wearing ${subjectOutfit}. REWRITE the body. `;
                } else if (keepOutfit) {
                    subjectInstruction += " PRESERVE OUTFIT: Keep the subject's clothing exactly as it is in the reference image. ";
                } else {
                    subjectInstruction += " CHANGE OUTFIT: The subject must wear a COMPLETELY NEW OUTFIT that fits the context of the scene. ";
                }
                subjectInstruction += " FACE LOCK: Maintain the exact eye line, camera angle, and facial identity of the subject. ";
            }
        }

        finalPrompt = subjectInstruction + finalPrompt;

        // Custom Instructions
        if (instructions) {
            finalPrompt += ` [USER INSTRUCTIONS]: ${instructions} `;
        }

        // Agentic Memory: Business Context
        const businessContext = await getBusinessContext(userId, admin);
        if (businessContext) {
            finalPrompt += `\n\n[BUSINESS BLUEPRINT CONTEXT - AGENTIC MEMORY]\n(Strictly adhere to these brand guidelines):\n${businessContext}\n`;
        }

        if (industry_intent) {
            finalPrompt += ` [INDUSTRY CONTEXT]: The image must match the '${industry_intent}' industry. `;
        }

        // Text Protection Fallback (If no replacement text provided)
        if (!(headline || subheadline || cta || promotion || business_name)) {
            finalPrompt += " [TEXT PRESERVATION]: Keep all existing text in the image visible and legible. Do not blur or cover the text. ";
        }
        // Clean up prompt if no subject lock
        finalPrompt += ", shot on Canon 5D Mk IV, 85mm lens, f/1.8, sharp focus, cinematic lighting, photorealistic, hyper-realistic, 8k, master photography";

        // Text Replacement Logic
        if (headline || subheadline || cta || promotion || business_name) {
            let textPrompt = " [TEXT REPLACEMENT MANDATE]: You must REPLACE the text in the original image with the new text provided below. Do NOT render the original text. ";
            textPrompt += " Render the new text clearly and professionally, maintaining the original layout style where possible but adapting to the new length. ";

            if (headline) textPrompt += `Headline: "${headline}". `;
            if (subheadline) textPrompt += `Subhead: "${subheadline}". `;
            if (cta) textPrompt += `Button/CTA: "${cta}". `;
            if (promotion) textPrompt += `Offer: "${promotion}". `;
            if (business_name) textPrompt += `Business Name: "${business_name}". `;

            // LOGO INSTRUCTION (Best effort for Fal)
            // Only generate if no specific logo was uploaded
            if (business_name && !logoUrl) {
                textPrompt += ` LOGO CREATION: You MUST generate a world-class, award-winning logo for the brand '${business_name}'. The logo should be a masterpiece of modern design—minimalist, iconic, and vector-style. Think Paul Rand meets Apple. Use bold geometry, negative space, and a premium color palette. It should look like a $10,000 corporate identity. Place it prominently and tastefully in the composition. `;
            }

            textPrompt += "Typography must be legible, sharp, and integrated into the scene. ";

            finalPrompt += textPrompt;
        }

        // Determine Final Strength
        let finalStrength = 0.75; // Default

        if (isNano && template_reference_image) {
            // Remix Mode Logic - Use same high strength for both cases
            finalStrength = 0.85;

            if (!(subjectOutfit && subjectOutfit.trim().length > 0)) {
                // For blank outfit: Add explicit "face only" instruction
                finalPrompt += " [FACE ONLY SWAP]: Only replace the FACE. Keep the ENTIRE body, pose, clothing, and proportions EXACTLY as they appear in Image 1. ";
            }
        }

        const imageUrl = await generateFalImage(model, finalPrompt, falImageSize, refImageUrl, template_reference_image, finalStrength, remixNegativePrompt);

        // 5. Save & Deduct
        const { data: inserted } = await admin.from("prompt_generations").insert({
            user_id: userId,
            image_url: imageUrl,
            combined_prompt_text: prompt,
            settings: {
                model,
                provider: "fal-creator-basic",
                logo_url: logoUrl, // Track it even if not used in generation
                template_reference_image: template_reference_image
            }
        }).select().single();

        if (!isAdmin) {
            await admin.rpc("decrement_credits", { x: IMAGE_COST, user_id_param: userId });
        }

        return NextResponse.json({
            images: [{ url: imageUrl }],
            generationId: inserted?.id || "temp",
            imageUrl,
            remainingCredits: !isAdmin ? (userProfile.credits - IMAGE_COST) : userProfile.credits
        });

    } catch (e: any) {
        console.error("Creator Gen Error:", e);
        return NextResponse.json({ error: e.message || "Generation Failed" }, { status: 500 });
    }
}
