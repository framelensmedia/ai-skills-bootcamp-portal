import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library"; // Restored
import { createAspectGuide } from "./ar_guide"; // Import Helper
import { NextRequest, NextResponse } from "next/server";
// sharp import removed (dynamic import used instead)

export const runtime = "nodejs";
export const maxDuration = 300;

const SYSTEM_CORE = `
[GLOBAL SYSTEM INSTRUCTIONS]
1. Reference-First Behavior: The first image provided (the Template) is the COMPOSITION BLUEPRINT. Maintain its framing/layout. Apply user instructions as edits to this blueprint. YOU ARE ALLOWED to change subject clothing, appearance, or background if explicitly requested.
2. Photorealism Default: Generate photorealistic, studio-quality results. 
   - **CAMERA SPEC**: Render with valid texture matching a "Canon 5D Mk IV with Sigma 85mm Art Lens". Sharp, high-resolution, creamy bokeh if depth is needed.
   - **METHOD**: Use a "Photoshop Cutout & Composite" approach. Subjects should look like they were photographed on location with perfect edge blending.
   - Avoid cartoonish or plastic looks unless requested.
3. Safe Rules: You may change clothing, background, lighting, and style. You must NOT change face geometry or distort the subject.
4. FRAMING ADAPTATION: If the Subject Reference pose differs significantly from the Template, you may adapt the composition/framing to fit the subject naturally.

[MAGIC LIGHTING & BLENDING (STRICT)]
1. GLOBAL ILLUMINATION: You MUST apply the scene's ambient light to all inserted subjects. Match the color temperature (Kelvin) and dynamic range.
2. SHADOW INTEGRATION: Subjects must cast realistic shadows that match the direction and hardness of the scene's light sources.
3. ATMOSPHERIC DEPTH: Apply atmospheric perspective (haze/depth) to the subject if they are further back in the scene.
4. NO FLAT LIGHTING: Never use flat front lighting unless the scene demands it. Use rim lighting and key lighting to match the template.

[MANDATORY SEMANTIC TEXT REPLACEMENT]
1. CONTEXT SYNC: If the user's instructions imply a change in Industry, Service, or Topic (e.g., Plumbing -> Tree Removal), you MUST REGENERATE ALL TEXT fields (Headline, Subhead, CTA, etc.) to match the new topic.
2. NO LEGACY TEXT: Never leave text from the old industry in the new design. If the template says "Emergency Plumbing" and the user asks for "Bakery", you must change it to something like "Fresh Bread".
3. AUTO-REWRITE: If the user does not provide specific text for a field, GENERATE it contextually based on the new topic. Do not preserve the original text if it conflicts with the new topic.

[GLOBAL FULL-BLEED LOCK]
1. MANDATORY: Output must be full-bleed.
2. FORBIDDEN: Borders, frames, polaroid styles, film strips, padding, or white margins.
3. The image must extend to the very edge of the canvas on all sides.
`;

const SYSTEM_HUMAN_RULES = `
[HUMAN SUBJECT IDENTITY LOCK (MANDATORY)]
- PRIMARY GOAL: Preserve the facial identity and key physical characteristics of the uploaded subject.
- MICRO-DETAILS: You MUST preserve specific details like moles, scars, asymmetry, and exact eye shape. Do not "correct" or "beautify" these features.
- INTEGRATION: You MUST blend the subject naturally into the scene. Match lighting, shadows, and color tone to the template.
- LIGHTING: Apply subtle studio lighting to the subject to ensure they look premium and well-integrated. This helps with blending and removing the 'cutout' look, but must NOT alter facial features.
- OUTFIT & BODY: If the user requests an outfit change, GENERATE the new outfit while keeping the subject's face/head. If no outfit change is requested, you may adapt the existing outfit's lighting/style to fit the scene.
- ADAPTATION: You are allowed to adjust the subject's pose slightly or complete missing parts of the anatomy if needed for the composition, BUT the face must remain recognizable as the uploaded person.
- AVOID: Do not create a cartoon or caricature unless the style dictates it. Maintain photorealism for the face.
`;

const SYSTEM_NON_HUMAN_RULES = `
[STYLE & OBJECT REFERENCE]
1. The Uploaded Image is a REFERENCE for Style or Object.
2. If the user asks to replace an object, use the Uploaded Object as the source.
3. If the user asks for style transfer, apply the visual style of the Uploaded Image to the Template composition.
`;

const SUBJECT_LOCK_HUMAN_INSTRUCTIONS = `
[SUBJECT LOCK: ACTIVE - STRICT MASKING MODE]
- **ACTION**: You act as a professional retoucher using Photoshop. You must CUT OUT the subject from the Subject Reference and COMPOSITE them into the Template.
- **CAMERA SPEC**: Render the subject with valid texture matching a "Canon 5D Mk IV with Sigma 85mm Art Lens". Sharp, high-resolution, creamy bokeh if depth is needed.
- **IDENTITY PRESERVATION (CRITICAL)**:
  1. DO NOT MORPH THE FACE. The face must be an EXACT pixel-perfect match to the uploaded reference.
  2. Do not "beautify", "cartoonify", or "AI-fy" the skin texture. Keep pores and natural skin details.
- **COMPOSITING & LIGHTING**:
  1. **Photoshop Cutout**: The subject should look like a clean extraction placed into the scene.
  2. **Subtle Studio Lighting**: Apply a soft "Beauty Dish" or "Rembrandt" lighting setup to the face to make it pop, but match the hue of the environment.
  3. **Edge Blending**: Ensure no white halos/fringing. Wrap the scene's light around the subject's edges (Rim Light).
- **OUTFIT**: Keep the subject's exact outfit unless asked to change.
`;

const FORCE_CUTOUT_INSTRUCTIONS = `
[HARD FORCE: PHOTOSHOP CUTOUT MODE (EXTREME)]
- **ACTION**: You must perform a digital "Scissors Cut" of the subject from the Reference Image and paste them into the Template.
- **ABSOLUTE IDENTITY LOCK**: You are FORBIDDEN from generating a new face. You MUST preserve the source facial structure, eyes, nose, and mouth shape 100%.
- **STYLE INTEGRATION**: You MUST adjust the subject's lighting, color grading, and texture to MATCH the scene's Global Style (e.g. Cinematic, Cartoon, etc.). The subject must not look like a "sticker" - they must be integrated.
- **ZERO HALLUCINATION**: Do not change the outfit, hair, or accessories unless explicitly told.
- **IDENTITY vs STYLE**: Prioritize Identity for the Face Geometry, but prioritize the Global Style for the Rendering (Lighting, Color, Shading).
- **HEAD ANGLE & GAZE LOCK**: You MUST preserve the exact head tilt, rotation, and eye-line of the subject. Build the scene around their gaze, do NOT rotate their face to match the scene.
`;

const SUBJECT_LOCK_OBJECT_INSTRUCTIONS = `
[OBJECT LOCK: ACTIVE]
- STRICTLY PRESERVE the Uploaded Object's appearance, shape, texture, packing, and branding.
- Do not warp or distort the product/object.
- Blend it naturally into the scene with matching lighting and shadows.
`;

const CREATIVE_FREEDOM_INSTRUCTIONS = `
[CREATIVE FREEDOM: ACTIVE]
- GOAL: Create an AMAZING, pleasantly surprising result. You have freedom to adapt the subject's outfit, pose, and lighting to perfectly match the style of the template.
- IDENTITY LOCK (CRITICAL): You must still maintain 100% FACIAL LIKENESS. The user must clearly recognize themselves.
- STUDIO LIGHTING (MANDATORY): Always apply subtle, high-quality studio lighting to the subject. Fix any poor lighting from the original photo to make it look professional and premium.
- BLENDING: Ensure the subject is not a "cutout". Blend them seamlessly into the environment with matching shadows and color grading.
`;

type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5" | "3:4";

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

function aspectHint(aspectRatio: AspectRatio) {
    switch (aspectRatio) {
        case "16:9":
            return "Output image in 16:9 landscape framing.";
        case "1:1":
            return "Output image in 1:1 square framing.";
        case "4:5":
            return "Output image in 4:5 portrait framing.";
        case "3:4":
            return "Output image in 3:4 portrait framing.";
        case "9:16":
        default:
            return "Output image in 9:16 vertical framing (TikTok/Reels style).";
    }
}

async function fileToBase64(file: File) {
    const ab = await file.arrayBuffer();
    return Buffer.from(ab).toString("base64");
}

// Helper to convert URL to base64
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
        console.warn(`Public fetch failed for ${url}, trying admin storage...`);
    }

    // Fallback: Try downloading via Supabase Admin (for private buckets)
    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Extract path using generic regex to handle various URL structures
        // Matches anything after /generations/
        const match = url.match(/\/generations\/(.+)$/);
        if (match && match[1]) {
            const decodedPath = decodeURIComponent(match[1]);
            console.log(`Fallback: Downloading private file from path: ${decodedPath}`);

            const { data, error } = await supabaseAdmin
                .storage
                .from("generations")
                .download(decodedPath);

            if (error) {
                console.error("Supabase Admin Download Error:", error);
                throw error;
            }
            if (!data) throw new Error("No data returned from storage download");

            const arrayBuffer = await data.arrayBuffer();
            return {
                data: Buffer.from(arrayBuffer).toString("base64"),
                mimeType: data.type || "image/png"
            };
        } else {
            console.warn("Could not extract storage path from URL:", url);
        }
    } catch (adminErr) {
        console.error("Admin storage download failed:", adminErr);
    }

    throw new Error(`Failed to fetch image (Public & Admin failed): ${url}`);
}

// --- FAL.AI INTEGRATION ---

async function generateFalImage(
    modelId: string, // "fal-ai/flux-pro/v1.1" or "fal-ai/flux-pro/v1.1-ultra"
    prompt: string,
    imageSize: any = "landscape_4_3", // or {width, height}
    mainImageUrl?: string | null,
    template_reference_image?: string | null,
    keepOutfit: boolean = true
) {
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("Missing FAL_KEY env var");

    const endpoint = `https://queue.fal.run/${modelId}`;

    // Helper: Extract simple ratio string if imageSize is an enum or object
    // But since we control the call site, let's just assume we want to pass "16:9" if it was "landscape_16_9" or pass the enum as "image_size".
    // Let's rely on the fact that we are passing `imageSize` which might be "landscape_16_9".
    // BUT we also want to send "aspectRatio": "16:9" just in case.

    const payload: any = {
        prompt,
        image_size: imageSize, // keep this
        safety_tolerance: "2",
    };

    // Add Strength for Img2Img (Remix)
    if (mainImageUrl) {
        // If keeping outfit, we need high fidelity (0.85-0.9).
        // If changing outfit, we need more freedom (lower strength), but not too low or face is lost.
        // For Nano Banana (Edit), this might be less critical than Flux, but good to tune.
        payload.strength = keepOutfit ? 0.85 : 0.70;
    }

    // Attempt to parse ratio string from imageSize if it's a known enum, or just pass it if provided
    // Actually, let's just add it if we can infer it. 
    // "landscape_16_9" -> "16:9"
    if (typeof imageSize === 'string' && imageSize.includes('16_9')) payload.aspect_ratio = "16:9";
    if (typeof imageSize === 'string' && imageSize.includes('9_16')) payload.aspect_ratio = "9:16";
    if (typeof imageSize === 'string' && imageSize.includes('square')) payload.aspect_ratio = "1:1";
    if (typeof imageSize === 'string' && imageSize.includes('4_3')) payload.aspect_ratio = "4:3";
    if (typeof imageSize === 'string' && imageSize.includes('3_4')) payload.aspect_ratio = "3:4";

    // Handle Nano Banana Pro specifically (uses image_urls array and /edit endpoint)
    const isNanoBanana = modelId.includes("nano-banana");

    if (isNanoBanana) {

        // REMIX ARCHITECTURE:
        // Base Canvas (image_url) = Template (Background/Scene)
        // Reference (image_urls) = Subject (Identity/Outfit)

        if (template_reference_image) {
            // Case 1: Remix (Template + Subject)
            payload.image_url = template_reference_image;

            // CRITICAL: We must include the Template in image_urls so "Image 1" in prompt refers to it.
            // Payload: Base=Template, Refs=[Template, Subject]
            payload.image_urls = [template_reference_image];

            if (mainImageUrl && mainImageUrl !== template_reference_image) {
                payload.image_urls.push(mainImageUrl);
            }

            // STRENGTH TUNING
            if (mainImageUrl) {
                if (keepOutfit) {
                    // Strength 0.75: Increased to preserve Scene/Text better. 
                    // Relies on prompt to force subject insertion.
                    payload.strength = 0.75;
                } else {
                    payload.strength = 0.65; // Lower strength to allow outfit changes while keeping pose
                }
            }
        } else {
            // Case 2: Direct Edit (No Template, just Selfie)
            if (mainImageUrl) payload.image_url = mainImageUrl;
            payload.image_urls = []; // No extra refs
            // For direct edit, we usually want to preserve the selfie unless instructed otherwise
            payload.strength = 0.75;
        }

        // Force 9:16 for Remixes if not square
        if (!payload.aspect_ratio) {
            if (imageSize === "portrait_16_9") payload.aspect_ratio = "9:16";
            else if (imageSize === "landscape_16_9") payload.aspect_ratio = "16:9";
        }
    } else {
        // Other Fal models use image_url (singular)
        if (mainImageUrl) payload.image_url = mainImageUrl;
    }

    // Use /edit endpoint for Nano Banana Pro if we have an image_url
    // (Which we now always do if mainImage or Template exists)
    const actualEndpoint = isNanoBanana && (payload.image_url || payload.image_urls?.length)
        ? `https://queue.fal.run/${modelId}/edit`
        : endpoint;

    console.log(`Fal Image Request (${modelId}):`, {
        prompt: prompt.slice(0, 50),
        hasImage: !!mainImageUrl,
        isNanoBanana,
        endpoint: actualEndpoint,
        image_size: imageSize // Added for debugging
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

    const { request_id } = await res.json();

    // 2. Poll for Status
    let attempts = 0;
    while (attempts < 60) { // 60 seconds max polling
        attempts++;
        await new Promise(r => setTimeout(r, 1000)); // 1s wait

        const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${request_id}`, {
            headers: {
                "Authorization": `Key ${falKey}`,
            },
        });

        if (!statusRes.ok) continue; // retry polling

        const statusJson = await statusRes.json();

        // Check for direct completion (some Fal models return images directly)
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

        // Only throw error if no images and not in progress
        throw new Error(`Fal.ai Generation Failed: ${JSON.stringify(statusJson)}`);
    }

    throw new Error("Fal.ai Generation Timed Out");
}

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get("content-type") || "";

        let rawPrompt = "";
        let userId = "";
        let promptId: string | null = null;
        let promptSlug: string | null = null;
        let ar: AspectRatio = "9:16";

        let original_prompt_text: string | null = null;
        let remix_prompt_text: string | null = null;
        let combined_prompt_text: string | null = null;

        // New fields
        let template_reference_image: string | null = null;
        let edit_instructions: string | null = null;
        let imageFiles: File[] = [];
        let logoFile: File | null = null;
        let businessName: string | null = null;
        let headline: string | null = null;
        let subheadline: string | null = null; // New
        let cta: string | null = null; // New
        let promotion: string | null = null; // New
        let templateFile: File | null = null;
        let canvasFile: File | null = null;
        let userSubjectFile: File | null = null;
        let subjectLock = false;
        let industryIntent: string | null = null;
        let intentQueue: any[] = [];
        let subjectMode: string = "non_human"; // Default

        let imageUrls: string[] = [];
        let logoUrl: string | null = null;
        let canvasUrl: string | null = null; // New
        let forceCutout = false; // New
        let requestedModel: string | null = null; // New
        let keepOutfit = true; // Default to true

        // 1. Parse Input
        if (contentType.includes("multipart/form-data")) {
            const form = await req.formData();

            // rawPrompt is likely the edit_instructions in the new flow
            rawPrompt = String(form.get("prompt") ?? "").trim();
            userId = String(form.get("userId") ?? "").trim();
            promptId = String(form.get("promptId") ?? "").trim() || null;
            promptSlug = String(form.get("promptSlug") ?? "").trim() || null;
            ar = (String(form.get("aspectRatio") ?? "9:16").trim() as AspectRatio) || "9:16";

            original_prompt_text = String(form.get("original_prompt_text") ?? "").trim() || null;
            remix_prompt_text = String(form.get("remix_prompt_text") ?? "").trim() || null;
            combined_prompt_text =
                String(form.get("combined_prompt_text") ?? "").trim() || rawPrompt || null;

            // New fields from form
            const canvasVal = form.get("canvas_image");
            if (canvasVal instanceof File) {
                canvasFile = canvasVal;
            }

            const tmplVal = form.get("template_reference_image");
            if (tmplVal instanceof File) {
                templateFile = tmplVal;
            } else {
                template_reference_image = String(tmplVal ?? "").trim() || null;
            }

            edit_instructions = String(form.get("edit_instructions") ?? "").trim() || null;

            logoFile = form.get("logo_image") as File | null;
            businessName = String(form.get("business_name") ?? "").trim() || null;
            if (!businessName) businessName = null;

            headline = String(form.get("headline") ?? "").trim() || null;
            if (!headline) headline = null;

            industryIntent = String(form.get("industry_intent") ?? "").trim() || null;

            // Allow override from client
            const clientSubjectMode = String(form.get("subjectMode") ?? "").trim();
            if (clientSubjectMode === "human" || clientSubjectMode === "non_human") {
                // We'll use this partially to override later
                subjectMode = clientSubjectMode;
            }

            try {
                const q = String(form.get("intent_queue") ?? "");
                if (q) intentQueue = JSON.parse(q);
            } catch (e) {
                console.warn("Failed to parse intent_queue", e);
            }

            imageFiles = form.getAll("images") as File[];
            subjectLock = String(form.get("subjectLock") ?? "false").trim() === "true";
            imageFiles = form.getAll("images") as File[];
            subjectLock = String(form.get("subjectLock") ?? "false").trim() === "true";
            forceCutout = String(form.get("forceCutout") ?? "false").trim() === "true";
            requestedModel = String(form.get("modelId") ?? "").trim() || null;
            keepOutfit = String(form.get("keepOutfit") ?? "true").trim() === "true";
        } else {
            // JSON Handling
            const body = await req.json();

            rawPrompt = String(body.prompt ?? "").trim();
            userId = String(body.userId ?? "").trim();
            promptId = String(body.promptId ?? "").trim() || null;
            promptSlug = String(body.promptSlug ?? "").trim() || null;
            ar = (String(body.aspectRatio ?? "9:16").trim() as AspectRatio) || "9:16";

            // JSON usually comes from prompt page which sends 'prompt' (final) and 'remix'
            remix_prompt_text = String(body.remix ?? "").trim() || null;
            combined_prompt_text = rawPrompt;
            // We don't get original_prompt_text explicitly in the current JSON payload from prompt page,
            // If not provided, default to TRUE if potential subject images exist and we are in human mode (Safe Default)
            if (body.subjectLock !== undefined) {
                subjectLock = String(body.subjectLock).trim() === "true";
            } else {
                // Auto-detect: If we have images and human mode, assume lock.
                subjectLock = (body.imageUrls?.length > 0 || String(body.subjectMode) === "human");
            }
            if (body.subjectMode) subjectMode = String(body.subjectMode).trim();
            industryIntent = String(body.industry_intent ?? "").trim() || null;

            // New Text Fields
            subheadline = body.subheadline ? String(body.subheadline).trim() : null;
            cta = body.cta ? String(body.cta).trim() : null;
            promotion = body.promotion ? String(body.promotion).trim() : null;

            intentQueue = body.intent_queue || [];
            if (Array.isArray(body.imageUrls)) {
                imageUrls = body.imageUrls.map(String);
            }
            // Parse Force Cutout
            forceCutout = String(body.forceCutout ?? "false").trim() === "true";

            logoUrl = body.logo_image ? String(body.logo_image).trim() : null;
            template_reference_image = body.template_reference_image ? String(body.template_reference_image).trim() : null;

            // ✅ Allow canvas_image from JSON (for Staged Edit Mode)
            if (body.canvas_image && typeof body.canvas_image === "string") {
                canvasUrl = String(body.canvas_image).trim();
            }

            // ✅ Read modelId from JSON payload
            requestedModel = body.modelId ? String(body.modelId).trim() || null : null;
            if (body.keepOutfit !== undefined) keepOutfit = String(body.keepOutfit) === "true";
        }

        // 2. Validation
        if (!rawPrompt && (!Array.isArray(intentQueue) || intentQueue.length === 0)) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

        // Strict Edit Mode Validation
        // Strict Edit Mode Validation
        if (Array.isArray(intentQueue) && intentQueue.length > 0 && !canvasFile && !canvasUrl) {
            return NextResponse.json({ error: "Edit Mode requires a valid Base Canvas Image." }, { status: 400 });
        }

        if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

        if (imageFiles.length > 10) {
            return NextResponse.json({ error: "Too many images. Max is 10 per request." }, { status: 400 });
        }
        if (imageFiles.length + imageUrls.length > 10) {
            return NextResponse.json({ error: "Too many images. Max is 10 per request." }, { status: 400 });
        }

        // Guardrails for uploads
        const MAX_PER_FILE = 7 * 1024 * 1024;
        const MAX_TOTAL = 20 * 1024 * 1024;
        let total = 0;

        for (const f of imageFiles) {
            total += f.size;
            if (f.size > MAX_PER_FILE) {
                return NextResponse.json(
                    { error: "One of your images is too large. Max per image is 7MB." },
                    { status: 400 }
                );
            }
        }
        if (total > MAX_TOTAL) {
            return NextResponse.json({ error: "Total upload too large. Max total is 20MB." }, { status: 400 });
        }

        // 2.5 Model Resolution (before credentials - so we can branch early)
        let model = requestedModel || process.env.VERTEX_MODEL_ID || "gemini-3-pro-image-preview";

        console.log(`GENERATE: requestedModel=${requestedModel}, resolved model=${model}`);

        // Handle "Nano Banana Pro" -> Fal mapping if client sends friendly name
        if (model === "nano-banana-pro") model = "fal-ai/nano-banana-pro";
        if (model === "seedream-4k") model = "fal-ai/flux-pro/v1.1-ultra";

        console.log(`GENERATE: final model after mapping=${model}`);

        // Setup Supabase Admin (needed for both branches)
        const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
        const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
        const admin = createClient(supabaseUrl, serviceRole);



        // Check Credits
        const { data: userProfile, error: profileErr } = await admin
            .from("profiles")
            .select("credits, role")
            .eq("user_id", userId)
            .single();

        if (profileErr || !userProfile) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        const userCredits = userProfile.credits ?? 0;
        const IMAGE_COST = 3;

        // Admins bypass credit check? Maybe for testing. Let's enforce for now unless explicit bypass requested.
        // If user has 0 credits, fail.
        if (userCredits < IMAGE_COST) {
            return NextResponse.json({
                error: "Insufficient credits. Please upgrade or top up.",
                required: IMAGE_COST,
                available: userCredits
            }, { status: 402 });
        }

        // --- BRANCH: FAL.AI MODELS ---
        if (model.startsWith("fal-ai/")) {
            console.log(`Using Fal Model: ${model}`);

            // Check Global Pause first
            try {
                const { data: config } = await admin
                    .from("app_config")
                    .select("value")
                    .eq("key", "generations_paused")
                    .maybeSingle();

                if (config?.value === true || config?.value === "true") {
                    const role = String(userProfile.role || "").toLowerCase();
                    const isBypass = role === "admin" || role === "super_admin";

                    if (!isBypass) {
                        return NextResponse.json({ error: "Generations are currently paused for maintenance." }, { status: 503 });
                    }
                }
            } catch (e) {
                console.warn("Global pause check failed (ignoring):", e);
            }

            // Prepare image URL if reference image provided
            let refImageUrl: string | null = null;
            if (imageFiles.length > 0) {
                // Upload first image to Supabase to get a public URL for Fal
                const firstFile = imageFiles[0];
                const ab = await firstFile.arrayBuffer();
                const buffer = Buffer.from(ab);
                const filePath = `fal-uploads/${userId}/${Date.now()}.jpg`;

                const { error: uploadErr } = await admin.storage
                    .from("generations")
                    .upload(filePath, buffer, { contentType: firstFile.type || "image/jpeg", upsert: false });

                if (!uploadErr) {
                    const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
                    refImageUrl = pubUrl.publicUrl;
                } else {
                    console.warn("Failed to upload reference image for Fal:", uploadErr);
                }
            } else if (imageUrls.length > 0) {
                refImageUrl = imageUrls[0];
            } else if (template_reference_image) {
                // Fallback: Use string passed from Remix/Edit flows
                refImageUrl = template_reference_image;
            }

            // Fal supports aspect ratio as string like "16:9" or object {width, height}
            // Flux models (Pro) require explicit dimensions to guarantee ratio in remix mode
            // BUT Nano Banana (Gemini) might prefer the standard enum strings
            let falImageSize: any = { width: 832, height: 1216 }; // Default 9:16 (Vertical) for Flux
            const ratio = ar as string;

            const isNano = model.includes("nano-banana");

            if (isNano) {
                // FORCE EXPLICIT DIMENSIONS for Remix (9:16)
                // Using enum strings often defaults to input size in /edit mode.
                // We want to force the canvas size.
                if (ratio === "9:16") falImageSize = { width: 832, height: 1216 };
                else if (ratio === "16:9") falImageSize = { width: 1216, height: 832 };
                else if (ratio === "1:1") falImageSize = { width: 1024, height: 1024 };
                else falImageSize = { width: 832, height: 1216 }; // Default
            } else {
                // Use Explicit Pixels for Flux
                if (ratio === "1:1") falImageSize = { width: 1024, height: 1024 };
                else if (ratio === "16:9") falImageSize = { width: 1216, height: 832 }; // Flux Optimized
                else if (ratio === "9:16") falImageSize = { width: 832, height: 1216 }; // Flux Optimized
                else if (ratio === "4:3") falImageSize = { width: 1024, height: 768 };
                else if (ratio === "3:4") falImageSize = { width: 768, height: 1024 };
                else if (ratio === "21:9") falImageSize = { width: 1536, height: 640 };
                else if (ratio === "9:21") falImageSize = { width: 640, height: 1536 };
                else if (typeof ratio === "string") falImageSize = ratio; // Fallback
            }

            // Enhance Prompt for Realism & Subject Consistency
            let finalFalPrompt = rawPrompt;
            let subjectInstruction = "";

            // 1. Enforce Photorealism (Default) unless style overrides
            const isCartoon = rawPrompt.toLowerCase().includes("cartoon") || rawPrompt.toLowerCase().includes("illustration") || rawPrompt.toLowerCase().includes("anime") || rawPrompt.toLowerCase().includes("sketch");
            if (!isCartoon) {
                // Add specific camera specs to match System Prompt
                finalFalPrompt += ", shot on Canon 5D Mk IV, 85mm lens, f/1.8, sharp focus, cinematic lighting, photorealistic, hyper-realistic, 8k, master photography";
            }

            // 2. Subject Lock Instructions (Eye Line / Angle)
            // 2. Subject Lock Instructions (Eye Line / Angle)
            if (refImageUrl && subjectLock) {

                // DETECT REMIX MODE (Template + Subject)
                // We handle this FIRST and exclusively for Nano to avoid ambiguous "Reference Image" terms
                if (isNano && template_reference_image && refImageUrl !== template_reference_image) {
                    subjectInstruction += " SCENE PRESERVATION: Keep the background, lighting, text, and composition of Image 1 (The Template) exactly as is. ";
                    subjectInstruction += " SUBJECT INSERTION: Insert the person from Image 2 into the scene. ";
                    subjectInstruction += " IGNORE SOURCE BACKGROUND: Completely ignore the background context/environment of Image 2. Only extract the person. ";

                    if (!keepOutfit) {
                        // Change Outfit Strategy: Keep Pose, but Allow Outfit Change described in Prompt
                        subjectInstruction += " BODY/POSE SOURCE: Use the body pose from Image 1 (The Template). ";
                        subjectInstruction += " OUTFIT INSTRUCTION: Generate the outfit described in the main prompt. Do NOT persist the outfit from Image 1 if it conflicts with the prompt. ";
                        subjectInstruction += " FACE SOURCE: Only use the Face/Head from Image 2 and composite it onto the body in Image 1. ";
                    } else {
                        // Keep Outfit CHECKED: Force User's Outfit (Image 2)
                        subjectInstruction += " OUTFIT SOURCE: Transfer the subject's clothing/outfit from Image 2. ";
                        subjectInstruction += " FACE LOCK: Preserve the exact facial identity, eyes, and gaze of the subject from Image 2. ";
                    }
                } else {
                    // STANDARD / GENERIC LOGIC (For single image or non-remix)
                    if (keepOutfit) {
                        subjectInstruction += " PRESERVE OUTFIT: Keep the subject's clothing exactly as it is in the reference image. ";
                    } else {
                        subjectInstruction += " CHANGE OUTFIT: The subject must wear a COMPLETELY NEW OUTFIT that fits the context of the scene. Do NOT use the clothing from the reference image. ";
                    }

                    // Standard Face Lock
                    subjectInstruction += " FACE LOCK: Maintain the exact eye line, camera angle, and facial identity of the subject. ";
                }

                // Prepend instructions
                finalFalPrompt = subjectInstruction + finalFalPrompt;
            }

            // 3. Text Rendering Instructions (Crucial for Remix)
            if (headline || subheadline || cta || promotion || businessName) {
                let textPrompt = " TEXT RENDERING: You must strictly render the following text in the image. Rearrange the layout to fit the 9:16 vertical aspect ratio naturally. ";
                if (headline) textPrompt += `Headline: "${headline}". `;
                if (subheadline) textPrompt += `Subhead: "${subheadline}". `;
                if (cta) textPrompt += `Button/CTA: "${cta}". `;
                if (promotion) textPrompt += `Offer: "${promotion}". `;
                if (businessName) textPrompt += `Business Name: "${businessName}". `;
                textPrompt += "Typography should be legible, professional, and integrated into the scene. ";

                finalFalPrompt += textPrompt;
            }

            try {
                const falImageUrl = await generateFalImage(model, finalFalPrompt, falImageSize, refImageUrl, template_reference_image, keepOutfit);
                console.log("Fal Image Generated:", falImageUrl);

                // Save to DB
                const { data: inserted, error: dbErr } = await admin.from("prompt_generations").insert({
                    user_id: userId,
                    prompt_id: promptId,
                    prompt_slug: promptSlug,
                    image_url: falImageUrl,
                    combined_prompt_text: finalFalPrompt,
                    settings: {
                        model,
                        provider: "fal",
                        input_images: refImageUrl ? 1 : 0,
                    },
                }).select().single();

                if (dbErr) {
                    console.error("DB Insert Error:", dbErr);
                    return NextResponse.json({ error: "Failed to save generation" }, { status: 500 });
                }

                // DEDUCT CREDITS
                const { error: rpcErr } = await admin.rpc("decrement_credits", { x: IMAGE_COST, user_id_param: userId });
                if (rpcErr) {
                    // Fallback if RPC missing
                    await admin.from("profiles").update({ credits: userCredits - IMAGE_COST }).eq("user_id", userId);
                }

                console.log("Fal Image Saved to DB:", inserted?.id);
                return NextResponse.json({ images: [{ url: falImageUrl }], generationId: inserted?.id, imageUrl: falImageUrl, remainingCredits: userCredits - IMAGE_COST });

            } catch (falErr: any) {
                console.error("Fal Generation Error:", falErr);
                return NextResponse.json({ error: falErr.message || "Fal generation failed" }, { status: 500 });
            }
        }

        // --- BRANCH: VERTEX / GEMINI ---
        // 3. ENV Setup (only needed for Vertex)
        const projectId = mustEnv("GOOGLE_CLOUD_PROJECT_ID");
        const location = (process.env.GOOGLE_CLOUD_LOCATION || "europe-west9").trim();

        const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
        let credentials;
        try {
            credentials = JSON.parse(credsJson);
        } catch {
            throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON");
        }

        // Check Global Pause (Fail-safe: continue if table missing)
        try {
            const { data: config } = await admin
                .from("app_config")
                .select("value")
                .eq("key", "generations_paused")
                .maybeSingle();

            if (config?.value === true || config?.value === "true") {
                // Check if user is admin
                const { data: profile } = await admin
                    .from("profiles")
                    .select("role")
                    .eq("user_id", userId)
                    .maybeSingle();

                const role = String(profile?.role || "").toLowerCase();
                const isBypass = role === "admin" || role === "super_admin";

                if (!isBypass) {
                    return NextResponse.json({ error: "Generations are currently paused for maintenance." }, { status: 503 });
                } else {
                    console.log(`Admin Bypass Active for user ${userId}`);
                }
            }
        } catch (e) {
            console.warn("Global pause check failed (ignoring):", e);
        }

        // 4. Vertex Auth
        const auth = new GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });

        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (!token?.token) {
            return NextResponse.json({ error: "Failed to get Vertex access token" }, { status: 401 });
        }

        const apiEndpoint = location === "global"
            ? "aiplatform.googleapis.com"
            : `${location}-aiplatform.googleapis.com`;

        const url = `https://${apiEndpoint}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;


        const imageParts: any[] = [];

        const isEditMode = (Array.isArray(intentQueue) && intentQueue.length > 0) || !!canvasFile || !!canvasUrl;

        if (isEditMode) {
            // --- EDIT MODE ---
            if (!canvasFile && !canvasUrl) {
                return NextResponse.json({ error: "Edit Mode requires a valid Base Canvas Image (canvas_image)." }, { status: 400 });
            }

            if (canvasFile) {
                const ab = await canvasFile.arrayBuffer();
                imageParts.push({ inlineData: { mimeType: canvasFile.type || "image/jpeg", data: Buffer.from(ab).toString("base64") } });
            } else if (canvasUrl) {
                try {
                    const { data, mimeType } = await urlToBase64(canvasUrl);
                    imageParts.push({ inlineData: { mimeType, data } });
                } catch (e) {
                    console.error("Failed to fetch canvas url:", canvasUrl, e);
                    return NextResponse.json({ error: "Failed to load Canvas Image" }, { status: 400 });
                }
            }

            // Attach user uploads (already compressed client-side)
            for (const f of imageFiles) {
                const ab = await f.arrayBuffer();
                imageParts.push({ inlineData: { mimeType: f.type || "image/jpeg", data: Buffer.from(ab).toString("base64") } });
            }
            // Attach URLs
            for (const url of imageUrls) {
                try {
                    const { data, mimeType } = await urlToBase64(url);
                    imageParts.push({ inlineData: { mimeType, data } });
                } catch (e: any) {
                    console.error("CRITICAL: Failed to download input url:", url, e);
                    return NextResponse.json({
                        error: "Failed to download subject image. Please try again.",
                        details: e.message
                    }, { status: 400 });
                }
            }

        } else {
            // --- REMIX MODE ---

            // 1. Template Image
            if (templateFile) {
                const data = await fileToBase64(templateFile);
                imageParts.push({ inlineData: { mimeType: templateFile.type || "image/jpeg", data } });
            } else if (template_reference_image) {
                try {
                    const { data, mimeType } = await urlToBase64(template_reference_image);
                    imageParts.push({ inlineData: { mimeType, data } });
                } catch (e: any) {
                    console.error("Failed to fetch template_reference_image", e);
                }
            }

            // 2. User Subject Image (Already optimized client-side)
            for (const f of imageFiles) {
                const ab = await f.arrayBuffer();
                imageParts.push({ inlineData: { mimeType: f.type || "image/jpeg", data: Buffer.from(ab).toString("base64") } });
            }
            for (const url of imageUrls) {
                try {
                    const { data, mimeType } = await urlToBase64(url);
                    imageParts.push({ inlineData: { mimeType, data } });
                } catch (e) {
                    console.error("Failed to download remix input url:", url, e);
                }
            }
        }

        // 3. Add Logo Image (if present)
        let logoInstruction = "";

        if (logoFile) {
            const ab = await logoFile.arrayBuffer();
            imageParts.push({ inlineData: { mimeType: logoFile.type || "image/png", data: Buffer.from(ab).toString("base64") } });
            logoInstruction = "LOGO REPLACEMENT: The FINAL IMAGE in the input list is the LOGO. Replace the template's existing logo/brand text with this exact logo image. Maintain its aspect ratio.";
        } else if (logoUrl) {
            try {
                const res = await fetch(logoUrl);
                if (res.ok) {
                    const ab = await res.arrayBuffer();
                    const mimeType = res.headers.get("content-type") || "image/png";
                    imageParts.push({ inlineData: { mimeType, data: Buffer.from(ab).toString("base64") } });
                    logoInstruction = "LOGO REPLACEMENT: The FINAL IMAGE in the input list is the LOGO. Replace the template's existing logo/brand text with this exact logo image. Maintain its aspect ratio.";
                }
            } catch (e) {
                console.error("Failed to download logo url:", logoUrl, e);
            }
        } else if (businessName) {
            logoInstruction = `LOGO GENERATION: Generate a professional logo for '${businessName}' and place it in the template's designated logo area.`;
        }

        // Fetch internal secret sauce
        let internalRules = "";
        // subjectMode is already initialized from form/body if present, or "non_human" by default?
        // Wait, I defined 'subjectMode' variable inside step 1 block in my head but I need to check where it is defined in the file.
        // It wasn't defined in the top scope in original file.
        // Let's check line 325: 'let subjectMode = "non_human";'

        // I should have defined it at top level.
        // Since I only added it to the 'if multipart' block in the previous tool call, it might be scoped (if I used 'let' inside block).
        // Actually I didn't verify if I used 'let' or assigned to outer.
        // In the previous step I added: 'subjectMode = clientSubjectMode;' implies assignment.
        // But 'subjectMode' wasn't defined in top scope in original file! It was defined at line 325.
        // So my previous edit might have caused a reference error if I tried to assign it before declaration.

        // Let's fix it by properly initializing it at line 125, and using it here.

        if (promptId) {
            const { data: dbTemplate } = await admin
                .from("prompts")
                .select("system_rules, subject_mode")
                .eq("id", promptId)
                .maybeSingle();

            if (dbTemplate) {
                internalRules = dbTemplate.system_rules || "";
                // Only override if not set by client? Or always prefer DB if strict?
                // Usually DB template rules are strict. But if "Remix" allows changing mode...
                // If client specifically sent it (from Wizard), we should probably respect it OR fallback.
                if (!subjectMode || subjectMode === "non_human") {
                    subjectMode = dbTemplate.subject_mode || "non_human";
                }
            }
        }

        const totalInputImages = imageFiles.length + imageUrls.length;

        const subjectRules = totalInputImages > 0
            ? (subjectMode === "human" ? SYSTEM_HUMAN_RULES : SYSTEM_NON_HUMAN_RULES)
            : "";

        const bgSwapInstruction = industryIntent ? `
[BACKGROUND SWAP: ACTIVE - Intent: ${industryIntent}]
- You MUST change the background environment to match the Industry Intent '${industryIntent}'.
- Keep the user photo as a locked 2D cutout (see SUBJECT LOCK).
- If background swap cannot be done safely without breaking the layout or subject, fall back to original background.
` : "";

        let editModeInstruction = "";
        if (Array.isArray(intentQueue) && intentQueue.length > 0) {
            const queueList = intentQueue.map((q, i) => `ACTION: ${String(q.intent).toUpperCase()} -> ${q.value}`).join("\n");

            editModeInstruction = `
### EDIT INSTRUCTIONS (STRICT)
You are an expert image editor. Your goal is to apply specific text or element changes to the provided CANVAS IMAGE while preserving everything else perfectly.

### ACTIONS TO PERFORM:
${queueList}

### GLOBAL CONSTRAINTS:
1.  **DO NOT REGENERATE THE SCENE**: Keep the background, lighting, and composition exactly as they are.
2.  **DO NOT REMOVE TEXT**: Unless the action says "Remove", you must PRESERVE all existing text, logos, and contact info (footer).
3.  **DO NOT CROP**: Maintain the full image canvas.
4.  **STYLE CONSISTENCY**: Match the font dictation, color, and style of the existing design.

Apply ONLY the actions listed above.
`;
        } else if (isEditMode && edit_instructions) {
            editModeInstruction = `
### EDIT INSTRUCTIONS
You are an expert image editor. Your goal is to apply changes to the provided CANVAS IMAGE.

### USER INSTRUCTION:
"${edit_instructions}"

### GLOBAL CONSTRAINTS:
1.  **PRESERVE LAYOUT**: Unless asked to change layout, keep the composition.
2.  **PRESERVE TEXT**: Unless asked to change text, keep existing text legible.

Execute the user's instruction precisely.
`;
        }

        const finalPrompt = [
            SYSTEM_CORE,
            internalRules ? `[TEMPLATE SPECIFIC RULES]\n${internalRules} ` : "",
            subjectRules,
            (subjectLock && totalInputImages > 0)
                ? (
                    (forceCutout)
                        ? FORCE_CUTOUT_INSTRUCTIONS
                        : (subjectMode === "human" ? SUBJECT_LOCK_HUMAN_INSTRUCTIONS : SUBJECT_LOCK_OBJECT_INSTRUCTIONS)
                )
                : "",
            (!subjectLock && totalInputImages > 0 && subjectMode === "human") ? CREATIVE_FREEDOM_INSTRUCTIONS : "",
            bgSwapInstruction,
            editModeInstruction,
            editModeInstruction,
            logoInstruction,
            "---",
            "USER INSTRUCTIONS:",
            (subjectLock && totalInputImages > 0 && subjectMode === "human")
                ? (forceCutout
                    ? "[CRITICAL: FULL BODY REPLACEMENT. The FIRST image is the Template. The SECOND image is the SUBJECT REFERENCE. You must CUT OUT the subject (Face + Body) from the SECOND image and paste them into the FIRST image, completely replacing the original subject or main element while matching the scene's composition.] " + rawPrompt
                    : "[CRITICAL: The FIRST image is the Template. The SECOND image is the SUBJECT REFERENCE. You must perform a Face Swap/Composite using the SECOND image face onto the FIRST image body/scene.] " + rawPrompt
                )
                : rawPrompt,
            "---",
            "TEXT CONTENT TO INCLUDE:",
            headline ? `HEADLINE: "${headline}"` : "",
            subheadline ? `SUBHEADLINE: "${subheadline}"` : "",
            cta ? `CALL TO ACTION: "${cta}"` : "",
            promotion ? `PROMO TEXT: "${promotion}"` : "",
            businessName ? `BUSINESS NAME: "${businessName}"` : "",
            "---",
            aspectHint(ar),
            (subjectMode === "human") ? "CRITICAL: The final image MUST look exactly like the uploaded person. Do not 'beautify' or 'cartoonify' the face." : ""
        ]
            .filter(Boolean)
            .join("\n\n");

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [...imageParts, { text: finalPrompt }],
                },
            ],
            generationConfig: {
                temperature: 0.7,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
            ],
        };

        // 6. Call Provider (Vertex or Fal)
        let res;
        let json;

        // FAL.AI BRANCH
        if (model.startsWith("fal-ai/")) {
            console.log(`Using Fal.ai Provider for model: ${model}`);
            try {
                // Determine aspect ratio for Fal with explicit dimensions (More robust for Flux/Edit)
                let falSize: any = { width: 1024, height: 768 }; // Default 4:3

                if (ar === "1:1") falSize = { width: 1024, height: 1024 };
                if (ar === "16:9") falSize = { width: 1216, height: 832 }; // Flux Optimized
                if (ar === "9:16") falSize = { width: 832, height: 1216 }; // Flux Optimized
                if (ar === "3:4") falSize = { width: 768, height: 1024 };
                if (ar === "4:5") falSize = { width: 832, height: 1024 };

                // Construct Prompt (Simplified for Fal, it doesn't need system instructions as prefix typically, but we can include)
                // Actually Flux follows prompt well. Let's send the "finalPrompt" text but maybe strip system headers if needed.
                // For now, sending the full prompt is safer to preserve instructions.

                // Resolve Main Image for Fal (Img2Img)
                let falMainImage = null;
                if (canvasUrl) falMainImage = canvasUrl;
                else if (template_reference_image) falMainImage = template_reference_image;
                else if (imageUrls && imageUrls.length > 0) falMainImage = imageUrls[0];

                const falImageUrl = await generateFalImage(model, finalPrompt, falSize, falMainImage);

                // Fal returns a URL. We need to download it to process it as we do for Vertex (upload to our storage)
                // Use urlToBase64 or similar logic?
                // Actually, step 7 expects 'res' and 'json'. We should restructure or just mock the response structure?
                // Or better: Handle Fal success here and jump to Step 9 (Insert History).

                // Let's refactor:
                // We'll return early for Fal for now to avoid breaking the Vertex flow below.

                // ... But we want to reuse the "Upload to Storage" and "Insert History" logic (Step 8 & 9).
                // So lets adapt the data to match "inline" format expected by Step 7/8.

                const { data: falBase64, mimeType: falMime } = await urlToBase64(falImageUrl);

                // Mock Vertex-like response structure so downstream code works?
                // Or just set variables and skip Vertex block.

                json = {
                    candidates: [{
                        content: {
                            parts: [{
                                inlineData: {
                                    mimeType: falMime,
                                    data: falBase64
                                }
                            }]
                        }
                    }]
                };

                // Mock 'res' as ok
                res = { ok: true, status: 200 };

            } catch (falErr: any) {
                console.error("FAL ERROR:", falErr);
                return NextResponse.json({ error: falErr.message || "Fal.ai generation failed" }, { status: 500 });
            }

        } else {
            // VERTEX BRANCH (Original Logic)
            // 6. Call Vertex with Retry Logic (Backoff)
            let attempts = 0;
            const maxAttempts = 2; // Strict limit to avoid Vercel 60s timeout

            while (attempts < maxAttempts) {
                try {
                    const apiEndpoint = location === "global"
                        ? "aiplatform.googleapis.com"
                        : `${location}-aiplatform.googleapis.com`;

                    const vertexUrl = `https://${apiEndpoint}/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

                    res = await fetch(vertexUrl, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${token.token}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(payload),
                    });

                    if (res.status === 429) {
                        console.warn(`VERTEX RATE LIMIT (429): Attempt ${attempts + 1}/${maxAttempts}. Retrying...`);
                        attempts++;
                        if (attempts < maxAttempts) {
                            // Wait 2s before retry
                            await new Promise(r => setTimeout(r, 2000));
                            continue;
                        }
                    }

                    // If success or other error, break
                    break;
                } catch (networkErr) {
                    console.error("Network Error during fetch:", networkErr);
                    throw networkErr;
                }
            }

            if (!res) throw new Error("Fetch failed to initialize");
            json = await res.json();
        }

        // Common Error Handling (Vertex Only mostly, but Fal handled above)
        if (!res.ok) {
            if (res.status === 429) {
                console.warn("VERTEX RATE LIMIT (429): Resource exhausted after retries.");
                return NextResponse.json(
                    { error: "System is busy (High Traffic). Please wait a minute and try again." },
                    { status: 429 }
                );
            }

            console.error("VERTEX ERROR", res.status, JSON.stringify(json, null, 2));

            return NextResponse.json(
                { error: "vertex_error", status: res.status, details: json },
                { status: res.status }
            );
        }

        // 7. Process Output
        const parts = json?.candidates?.[0]?.content?.parts ?? [];
        const inline = Array.isArray(parts)
            ? parts.find(
                (p) => p?.inlineData?.data && String(p?.inlineData?.mimeType || "").startsWith("image/")
            )
            : null;

        if (!inline) {
            return NextResponse.json({ error: "No image returned", details: json }, { status: 502 });
        }

        const outMime = String(inline.inlineData.mimeType);
        const outBase64 = String(inline.inlineData.data);

        const bytes = Buffer.from(outBase64, "base64");

        // 8. Parallel Uploads (Original & Optimized) to save time
        const originalExt = outMime.includes("png") ? "png" : outMime.includes("webp") ? "webp" : "jpg";
        const timestamp = Date.now();

        const originalFilePath = `users/${userId}/${timestamp}.${originalExt}`;
        const optimizedFilePath = `users/${userId}/${timestamp}_opt.${originalExt}`;

        // Since we are bypassing Sharp for now, optimizedBytes is just bytes
        const optimizedBytes = bytes;

        // Execute uploads in parallel
        const [originalUpload, optimizedUpload] = await Promise.all([
            admin.storage
                .from("generations")
                .upload(originalFilePath, bytes, { contentType: outMime, upsert: false }),
            admin.storage
                .from("generations")
                .upload(optimizedFilePath, optimizedBytes, { contentType: outMime, upsert: false })
        ]);

        if (originalUpload.error) {
            console.error("Failed to upload original:", originalUpload.error);
        }

        if (optimizedUpload.error) {
            return NextResponse.json({ error: optimizedUpload.error.message }, { status: 500 });
        }

        // Get URLs (synchronous usually, but good to be safe)
        const { data: originalPub } = admin.storage.from("generations").getPublicUrl(originalFilePath);
        const originalUrl = originalPub.publicUrl;

        // const { data: optimizedPub } = admin.storage.from("generations").getPublicUrl(optimizedFilePath); // Already declared above or not needed if we just use the line below
        const { data: optimizedPub } = admin.storage.from("generations").getPublicUrl(optimizedFilePath);
        const imageUrl = optimizedPub.publicUrl;

        // 9. Insert History
        try {
            await admin.from("prompt_generations").insert({
                user_id: userId,
                prompt_id: promptId,
                prompt_slug: promptSlug,
                image_url: imageUrl,

                original_prompt_text,
                remix_prompt_text,
                combined_prompt_text: combined_prompt_text || rawPrompt,

                settings: {
                    aspectRatio: ar,
                    model,
                    provider: "vertex",
                    input_images: imageFiles.length + imageUrls.length,
                    original_prompt_text,
                    remix_prompt_text,
                    combined_prompt_text: combined_prompt_text || rawPrompt,
                    edit_instructions,
                    template_reference_image,
                    headline,
                    full_quality_url: originalUrl, // Save Full Quality URL
                },
            });
        } catch (e) {
            console.error("prompt_generations insert failed:", e);
            // don't fail the request, just log it
        }

        // DEDUCT CREDITS (Vertex)
        {
            const { error: rpcErr } = await admin.rpc("decrement_credits", { x: IMAGE_COST, user_id_param: userId });
            if (rpcErr) {
                await admin.from("profiles").update({ credits: userCredits - IMAGE_COST }).eq("user_id", userId);
            }
        }

        return NextResponse.json({ imageUrl, fullQualityUrl: originalUrl, remainingCredits: userCredits - IMAGE_COST }, { status: 200 });
    } catch (e: any) {
        console.error("GENERATE ERROR:", e);
        return NextResponse.json(
            { error: "server_error", message: e?.message || "Unexpected error" },
            { status: 500 }
        );
    }
}
