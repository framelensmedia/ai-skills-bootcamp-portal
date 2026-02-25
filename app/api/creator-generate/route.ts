
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

// Helper to convert URL to base64
async function urlToBase64(url: string) {
    try {
        const res = await fetch(url);
        if (res.ok) {
            const ab = await res.arrayBuffer();
            return {
                data: Buffer.from(ab).toString("base64"),
                mimeType: res.headers.get("content-type") || "image/png"
            };
        }
    } catch (e) {
        console.warn(`Fetch failed for ${url}`);
    }
    return null;
}

async function generateFalImage(
    modelId: string,
    prompt: string,
    imageSize: any,
    mainImageUrl?: string | string[] | null,
    template_reference_image?: string | null,
    strength?: number,
    negativePrompt?: string,
    onSubmit?: (requestId: string, responseUrl: string) => Promise<void>
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
        let imagesToSend: string[] = [];
        const mainImages = Array.isArray(mainImageUrl) ? mainImageUrl : (mainImageUrl ? [mainImageUrl] : []);

        if (template_reference_image) {
            imagesToSend.push(template_reference_image);
            for (const img of mainImages) {
                if (img !== template_reference_image) {
                    imagesToSend.push(img);
                }
            }
        } else if (mainImages.length > 0) {
            imagesToSend.push(...mainImages);
            payload.strength = strength || 0.75;
        }

        if (imagesToSend.length > 0) {
            // Convert to Base64 to avoid Fal file download errors with special chars
            const base64ImagesToSend: string[] = [];
            for (const imgUrl of imagesToSend) {
                if (imgUrl.trim().startsWith("http")) {
                    try {
                        const b64 = await urlToBase64(imgUrl);
                        if (b64 && b64.data) {
                            base64ImagesToSend.push(`data:${b64.mimeType};base64,${b64.data}`);
                        } else {
                            base64ImagesToSend.push(imgUrl); // Fallback
                        }
                    } catch (e) {
                        base64ImagesToSend.push(imgUrl); // Fallback
                    }
                } else if (imgUrl.trim().startsWith("data:")) {
                    base64ImagesToSend.push(imgUrl);
                }
            }

            payload.image_urls = base64ImagesToSend;
        } else {
            delete payload.image_urls;
            delete payload.image_url;
        }

        // Apply override if provided (covers Remix case too)
        if (strength) payload.strength = strength;

        // Force 9:16 for Remixes if not square
        if (!payload.aspect_ratio) {
            payload.aspect_ratio = "9:16"; // Default
        }
    } else {
        const mainImages = Array.isArray(mainImageUrl) ? mainImageUrl : (mainImageUrl ? [mainImageUrl] : []);
        if (mainImages.length > 0) payload.image_url = mainImages[0];
    }

    // Use /edit endpoint if image provided
    const actualEndpoint = isNanoBanana && payload.image_urls?.length > 0
        ? `https://queue.fal.run/${modelId}/edit`
        : endpoint;

    console.log(`CREATOR GEN (${modelId}):`, {
        prompt: prompt.slice(0, 50),
        endpoint: actualEndpoint,
        imageUrlsCount: payload.image_urls?.length || 0,
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
    const response_url = initialJson.response_url;
    if (!request_id) {
        throw new Error(`Fal.ai returned no request_id and no images: ${JSON.stringify(initialJson)}`);
    }

    // Notify caller with request_id so it can save the pending record
    if (onSubmit) await onSubmit(request_id, response_url || "").catch(() => { });

    // 2. Poll
    const startTime = Date.now();
    const TIMEOUT_MS = 290000; // 290s
    let attempts = 0;

    while (Date.now() - startTime < TIMEOUT_MS) {
        attempts++;
        await new Promise(r => setTimeout(r, 2000));

        // First: try fetching response_url directly (fast path if Fal is done)
        if (response_url) {
            try {
                const ctrl = new AbortController();
                const tid = setTimeout(() => ctrl.abort(), 5000);
                const directRes = await fetch(response_url, {
                    headers: { "Authorization": `Key ${falKey}` },
                    signal: ctrl.signal,
                });
                clearTimeout(tid);
                if (directRes.ok) {
                    const directJson = await directRes.json();
                    const url = directJson.images?.[0]?.url || directJson.image?.url;
                    if (url) return url;
                }
            } catch (_) { /* timeout or network — fall through to status check */ }
        }

        const statusUrl = `https://queue.fal.run/${modelId}/requests/${request_id}/status`;
        const statusRes = await fetch(statusUrl, {
            headers: { "Authorization": `Key ${falKey}` },
        });

        if (!statusRes.ok) {
            const errText = await statusRes.text();
            console.warn(`Attempt ${attempts}: Status Check Failed (${statusRes.status}) - ${errText}`);
            continue;
        }

        const statusJson = await statusRes.json();
        console.log(`Attempt ${attempts}: Status=${statusJson.status}`);

        if (statusJson.images?.[0]?.url) return statusJson.images[0].url;

        if (statusJson.status === "COMPLETED") {
            if (response_url) {
                const resultRes = await fetch(response_url, { headers: { "Authorization": `Key ${falKey}` } });
                const resultJson = await resultRes.json();
                const imageUrl = resultJson.images?.[0]?.url || resultJson.image?.url;
                if (!imageUrl) throw new Error(`Fal.ai completed but returned no image URL: ${JSON.stringify(resultJson)}`);
                return imageUrl;
            }
            const imageUrl = statusJson.images?.[0]?.url;
            if (!imageUrl) throw new Error("Fal.ai completed but returned no image URL in status");
            return imageUrl;
        }

        if (statusJson.status === "IN_QUEUE" || statusJson.status === "IN_PROGRESS") continue;

        console.error("Unknown Status:", JSON.stringify(statusJson));
        throw new Error(`Fal.ai Generation Failed: ${JSON.stringify(statusJson)}`);
    }

    console.error("TIMEOUT REACHED. Last known status:", attempts);
    throw new Error("Fal.ai Generation Timed Out");
}

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get("content-type") || "";

        let prompt = "";
        let cleanPrompt = "";
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
            cleanPrompt = (formData.get("combined_prompt_text") as string) || prompt;
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
            cleanPrompt = body.combined_prompt_text || prompt;
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

        // 3. Handle Image Uploads and Multi-Image Array
        let falImages: string[] = [];

        for (const file of imageFiles) {
            const ab = await file.arrayBuffer();
            const filePath = `fal-uploads/${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const { error: uploadErr } = await admin.storage.from("generations").upload(filePath, Buffer.from(ab), { contentType: file.type || "image/jpeg", upsert: false });
            if (!uploadErr) {
                const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
                falImages.push(pubUrl.publicUrl);
            }
        }

        // Add imageUrls from JSON body
        for (const url of imageUrls) {
            if (!falImages.includes(url)) falImages.push(url);
        }

        // Handle Logo Upload
        let falLogoUrl: string | null = null;
        if (logoFile) {
            const ab = await logoFile.arrayBuffer();
            const filePath = `fal-uploads/${userId}/logo-${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
            const { error: uploadErr } = await admin.storage.from("generations").upload(filePath, Buffer.from(ab), { contentType: logoFile.type || "image/png", upsert: false });
            if (!uploadErr) {
                const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
                falLogoUrl = pubUrl.publicUrl;
            }
        } else if (logoUrl) {
            falLogoUrl = logoUrl;
        }

        if (falLogoUrl) {
            falImages.push(falLogoUrl);
        }

        console.log("[CREATOR DEBUG] falImages count:", falImages.length, "imageUrls received:", imageUrls.length, "imageFiles received:", imageFiles.length, "template:", template_reference_image?.slice(0, 60));

        let refImageUrl = falImages.length > 0 ? falImages[0] : null;

        // 3. Prepare Prompt Engine
        let finalPrompt = prompt;
        let subjectInstruction = "";
        let remixNegativePrompt: string | undefined;

        let model = requestedModel || "fal-ai/nano-banana-pro";
        if (model === "nano-banana-pro") model = "fal-ai/nano-banana-pro";
        const isNano = model.includes("nano-banana");

        let falImageSize: any = { width: 832, height: 1216 };
        if (aspectRatio === "16:9") falImageSize = { width: 1216, height: 832 };
        else if (aspectRatio === "1:1") falImageSize = { width: 1024, height: 1024 };
        else if (aspectRatio === "4:5") falImageSize = { width: 832, height: 1024 };

        if (refImageUrl && subjectLock) {
            if (template_reference_image && refImageUrl !== template_reference_image) {
                subjectInstruction += " [SUBJECT REPLACEMENT MODE - STRICT LAYOUT LOCK] ";
                subjectInstruction += " 1. TASK: Face Swap. Replace the face of the person in Image 1 (Template) with the face of the Subject from Image 2. ";
                subjectInstruction += " 2. PRESERVE DETAILS: Keep Image 1's exact background, text, and PROPS. ";
                subjectInstruction += " 3. SCALE & FIT: The subject's body must be the SAME SIZE as the original person in Image 1. ";
                subjectInstruction += " 4. LIKENESS: The face must match Image 2 exactly. ";
                subjectInstruction += " 5. [FACE IDENTITY LOCK]: DO NOT blend, mix, or morph the face. ";
                remixNegativePrompt = "enlarged subject, oversized person, zoomed in, face morphing, morphed face, mixed identity, blended faces, different person, wrong person, old face, missing props";
                if (subjectOutfit && subjectOutfit.trim().length > 0) {
                    subjectInstruction += ` OUTFIT: The subject is wearing ${subjectOutfit}. `;
                } else {
                    subjectInstruction += " OUTFIT: The subject is wearing the same clothes from Image 1. ";
                }
            } else {
                const subjectCount = falImages.filter(u => u !== falLogoUrl).length;
                if (subjectCount >= 2) {
                    subjectInstruction += ` [MULTI-SUBJECT MANDATE]: You have been given ${subjectCount} reference images. `;
                    subjectInstruction += ` You MUST include ALL ${subjectCount} subjects in the final image. `;
                } else {
                    if (subjectOutfit && subjectOutfit.trim().length > 0) {
                        subjectInstruction += ` OUTFIT: The subject is wearing ${subjectOutfit}. `;
                    } else if (keepOutfit) {
                        subjectInstruction += " PRESERVE OUTFIT: Keep the subject's clothing exactly as it is. ";
                    } else {
                        subjectInstruction += " CHANGE OUTFIT: The subject must wear a COMPLETELY NEW OUTFIT. ";
                    }
                    subjectInstruction += " FACE LOCK: Maintain the exact eye line, camera angle, and facial identity. ";
                }
            }
        }

        finalPrompt = subjectInstruction + finalPrompt;

        if (instructions) finalPrompt += ` [USER INSTRUCTIONS]: ${instructions} `;

        const businessContext = await getBusinessContext(userId, admin);
        if (businessContext) {
            finalPrompt += `\n\n[BUSINESS BLUEPRINT CONTEXT - AGENTIC MEMORY]\n${businessContext}\n`;
        }

        if (industry_intent) finalPrompt += ` [INDUSTRY CONTEXT]: The image must match the '${industry_intent}' industry. `;

        if (!(headline || subheadline || cta || promotion || business_name)) {
            finalPrompt += " [TEXT PRESERVATION]: Keep all existing text in the image visible and legible. ";
        }
        finalPrompt += ", shot on Canon 5D Mk IV, 85mm lens, f/1.8, sharp focus, cinematic lighting, photorealistic, hyper-realistic, 8k, master photography";

        if (headline || subheadline || cta || promotion || business_name) {
            let textPrompt = " [TEXT REPLACEMENT MANDATE]: You must REPLACE the text in the original image with the new text provided below. ";
            if (headline) textPrompt += `Headline: "${headline}". `;
            if (subheadline) textPrompt += `Subhead: "${subheadline}". `;
            if (cta) textPrompt += `Button/CTA: "${cta}". `;
            if (promotion) textPrompt += `Offer: "${promotion}". `;
            if (business_name) textPrompt += `Business Name: "${business_name}". `;
            if (falLogoUrl) textPrompt += " [LOGO MANDATE] You MUST place the final reference image (the Logo) onto the design. ";
            else if (business_name && !logoUrl) textPrompt += ` LOGO CREATION: Generate a premium logo for '${business_name}'. `;
            textPrompt += "Typography must be legible, sharp, and integrated into the scene. ";
            finalPrompt += textPrompt;
        } else if (falLogoUrl) {
            finalPrompt += " [LOGO MANDATE] You MUST place the final reference image (the Logo) onto the design. ";
        }

        let finalStrength = 0.75;
        if (isNano && template_reference_image) {
            finalStrength = 0.85;
            if (!(subjectOutfit && subjectOutfit.trim().length > 0)) {
                finalPrompt += " [FACE ONLY SWAP]: Only replace the FACE. Keep the ENTIRE body, pose, clothing, and proportions EXACTLY as in Image 1. ";
            }
        }

        const falMainImage = falImages.length > 0 ? falImages : (refImageUrl || null);

        // ── ASYNC PENDING PATTERN ──────────────────────────────────────────────────
        // Deduct credits immediately; save a pending record that gets updated on success.
        if (!isAdmin) {
            await admin.rpc("decrement_credits", { x: IMAGE_COST, user_id_param: userId });
        }

        let pendingGenerationId: string | null = null;
        const { data: pendingRecord, error: pendingErr } = await admin
            .from("prompt_generations")
            .insert({
                user_id: userId,
                image_url: "",  // placeholder — updated on completion
                combined_prompt_text: cleanPrompt,
                settings: {
                    model,
                    provider: "fal-creator-basic",
                    status: "pending",
                    logo_url: logoUrl,
                    template_reference_image,
                    full_prompt: finalPrompt,
                }
            })
            .select("id")
            .single();

        if (!pendingErr && pendingRecord?.id) {
            pendingGenerationId = pendingRecord.id;
        } else {
            console.error("[Creator] Failed to save pending record:", pendingErr?.message);
        }

        try {
            const imageUrl = await generateFalImage(
                model, finalPrompt, falImageSize, falMainImage, template_reference_image, finalStrength, remixNegativePrompt,
                // onSubmit: update the pending record with fal tracking info
                async (requestId, responseUrl) => {
                    if (pendingGenerationId) {
                        await admin.from("prompt_generations").update({
                            settings: {
                                model, provider: "fal-creator-basic", status: "pending",
                                fal_request_id: requestId, fal_response_url: responseUrl,
                                logo_url: logoUrl, template_reference_image,
                            }
                        }).eq("id", pendingGenerationId);
                    }
                }
            );

            // Success: update the pending record with the real image URL
            if (pendingGenerationId) {
                await admin.from("prompt_generations").update({
                    image_url: imageUrl,
                    settings: {
                        model, provider: "fal-creator-basic", status: "completed",
                        logo_url: logoUrl, template_reference_image, full_prompt: finalPrompt,
                    }
                }).eq("id", pendingGenerationId);
            }

            return NextResponse.json({
                images: [{ url: imageUrl }],
                generationId: pendingGenerationId || "temp",
                imageUrl,
                remainingCredits: !isAdmin ? (userProfile.credits - IMAGE_COST) : userProfile.credits
            });

        } catch (falErr: any) {
            // If Fal timed out AND we have a pending record, return 202 so the frontend can poll
            if (falErr.message?.includes("Timed Out") && pendingGenerationId) {
                return NextResponse.json(
                    { status: "pending", generationId: pendingGenerationId, remainingCredits: !isAdmin ? (userProfile.credits - IMAGE_COST) : userProfile.credits },
                    { status: 202 }
                );
            }
            throw falErr;
        }

    } catch (e: any) {
        console.error("Creator Gen Error:", e);
        return NextResponse.json({ error: e.message || "Generation Failed" }, { status: 500 });
    }
}
