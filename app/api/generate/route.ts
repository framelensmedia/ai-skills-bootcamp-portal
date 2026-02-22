import { createClient } from "@supabase/supabase-js";
import { GoogleAuth } from "google-auth-library"; // Restored
import { createAspectGuide } from "./ar_guide"; // Import Helper
import { NextRequest, NextResponse } from "next/server";
import { triggerAutoRechargeIfNeeded } from "@/lib/autoRecharge";
import { getBusinessContext } from "@/lib/businessContext"; // Agentic
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
            // console.log(`Fallback: Downloading private file from path: ${decodedPath}`);

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
    mainImageUrl?: string | string[] | null,
    template_reference_image?: string | null,
    keepOutfit: boolean = true,
    negativePrompt?: string,
    strengthOverride?: number,
    subjectFirst: boolean = false // When true, subject is Image 1 (preserved) and template is Image 2 (reference)
) {
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("Missing FAL_KEY env var");

    const endpoint = `https://queue.fal.run/${modelId}`;

    // Helper: Extract simple ratio string
    const isNanoBanana = modelId.includes("nano-banana");

    let payload: any;

    if (isNanoBanana) {
        // Nano Banana Default Payload
        payload = {
            prompt,
            safety_tolerance: "4",
            resolution: "1K",
            negative_prompt: negativePrompt // Pass negative prompt
        };

        // Apply Strength for Edit Mode (Nano supports it)
        if (strengthOverride) {
            payload.strength = strengthOverride;
        }

        // Aspect Ratio Logic...
        if (typeof imageSize === 'string') {
            if (imageSize.includes('9_16') || imageSize.includes('portrait')) payload.aspect_ratio = "9:16";
            else if (imageSize.includes('16_9') || imageSize.includes('landscape')) payload.aspect_ratio = "16:9";
            else if (imageSize.includes('square') || imageSize.includes('1_1')) payload.aspect_ratio = "1:1";
            else if (imageSize.includes('4_3')) payload.aspect_ratio = "4:3";
            else if (imageSize.includes('3_4')) payload.aspect_ratio = "3:4";
            else payload.aspect_ratio = "auto";
        } else if (imageSize && typeof imageSize === 'object') {
            payload.image_size = imageSize;
            if (imageSize.width > imageSize.height) payload.aspect_ratio = "16:9";
            else if (imageSize.width === imageSize.height) payload.aspect_ratio = "1:1";
            else if (imageSize.width === 832 && imageSize.height === 1024) payload.aspect_ratio = "4:5";
            else payload.aspect_ratio = "9:16";
        } else {
            payload.aspect_ratio = "9:16";
        }
    } else {
        // Flux/Other Payload
        payload = {
            prompt,
            image_size: imageSize,
            safety_tolerance: "2",
            negative_prompt: negativePrompt || "cartoon, illustration, animation, face distortion, strange anatomy, disfigured, bad art, blurry, pixelated"
        };
        // Add Strength for Img2Img
        if (mainImageUrl) {
            payload.strength = strengthOverride || (keepOutfit ? 0.85 : 0.70);
        }

        if (typeof imageSize === 'string' && imageSize.includes('16_9')) payload.aspect_ratio = "16:9";
        if (typeof imageSize === 'string' && imageSize.includes('9_16')) payload.aspect_ratio = "9:16";
        if (typeof imageSize === 'string' && imageSize.includes('square')) payload.aspect_ratio = "1:1";
    }

    // --- ENDPOINT & IMAGE HANDLING ---
    let actualEndpoint = endpoint;

    if (isNanoBanana) {
        // Determine if we are Editing (Remix) or Generating (T2I)
        let imagesToSend: string[] = [];
        const mainImages = Array.isArray(mainImageUrl) ? mainImageUrl : (mainImageUrl ? [mainImageUrl] : []);

        if (template_reference_image) {
            // REMIX MODE
            if (subjectFirst && mainImages.length > 0) {
                // SUBJECT-FIRST: Subjects are first, Template is last
                imagesToSend.push(...mainImages);
                if (!mainImages.includes(template_reference_image)) {
                    imagesToSend.push(template_reference_image);
                }
            } else {
                // DEFAULT: Template is Image 1, Subjects are subsequent
                imagesToSend.push(template_reference_image);
                for (const img of mainImages) {
                    if (img !== template_reference_image) {
                        imagesToSend.push(img);
                    }
                }
            }
        } else if (mainImages.length > 0) {
            // DIRECT EDIT MODE
            imagesToSend.push(...mainImages);
        }

        // If we have images, use /edit and attach image_urls
        if (imagesToSend.length > 0) {
            actualEndpoint = `https://queue.fal.run/${modelId}/edit`;

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
            // console.log(`NANO BANANA EDIT: Sending ${imagesToSend.length} images. subjectFirst=${subjectFirst}. Image 1: ${imagesToSend[0]?.slice(0, 60)}, Image 2: ${imagesToSend[1]?.slice(0, 60) || 'NONE'}`);
        } else {
            // T2I MODE (Base Endpoint)
            // MUST NOT send empty image_urls or image_url
            delete payload.image_urls;
            delete payload.image_url;
        }
    } else {
        // Standard Models (Flux)
        const mainImages = Array.isArray(mainImageUrl) ? mainImageUrl : (mainImageUrl ? [mainImageUrl] : []);
        if (mainImages.length > 0) {
            payload.image_url = mainImages[0]; // Flux only takes 1
        }
    }

    // console.log(`Fal Image Request (${modelId}):`, {
    //     prompt: prompt.slice(0, 50),
    //     endpoint: actualEndpoint,
    //     hasImages: !!(payload.image_url || payload.image_urls?.length)
    // });

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
        return initialJson.images[0].url;
    }

    const request_id = initialJson.request_id;
    if (!request_id) {
        throw new Error(`Fal.ai returned no request_id and no images: ${JSON.stringify(initialJson)}`);
    }

    // 2. Poll for Status (Time-based to respect Vercel 300s limit)
    const startTime = Date.now();
    const TIMEOUT_MS = 290000; // 290s (Leave 10s buffer)

    while (Date.now() - startTime < TIMEOUT_MS) {
        await new Promise(r => setTimeout(r, 1000)); // 1s wait

        // Use the actual endpoint path for polling (includes /edit if we submitted to /edit)
        const basePath = actualEndpoint.replace('https://queue.fal.run/', '').replace('/edit', '');
        const statusRes = await fetch(`https://queue.fal.run/${basePath}/requests/${request_id}`, {
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

        let subjectOutfit: string | null = null; // NEW: Custom outfit description

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
            subjectOutfit = String(form.get("subjectOutfit") ?? "").trim() || null;
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

            // New Text Fields - Extract all text fields from JSON body
            headline = body.headline ? String(body.headline).trim() : null;
            subheadline = body.subheadline ? String(body.subheadline).trim() : null;
            cta = body.cta ? String(body.cta).trim() : null;
            promotion = body.promotion ? String(body.promotion).trim() : null;
            businessName = body.business_name ? String(body.business_name).trim() : null;

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
            subjectOutfit = body.subjectOutfit ? String(body.subjectOutfit).trim() : null;
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
        // DEFAULT TO Fal (Nano Banana) for all image gen if not specified, as Vertex Gemini Preview is unstable/404ing
        let model = requestedModel || process.env.VERTEX_MODEL_ID || "fal-ai/nano-banana-pro";

        // console.log(`GENERATE: requestedModel=${requestedModel}, resolved model=${model}`);

        // Handle "Nano Banana Pro" -> Fal mapping if client sends friendly name
        // Note: /edit suffix is added by generateFalImage when image_url is provided
        if (model === "nano-banana-pro") model = "fal-ai/nano-banana-pro";
        if (model === "seedream-4k") model = "fal-ai/flux-pro/v1.1-ultra";

        // User requested to keep nano-banana-pro even for T2I
        // Logging to debug why image might be missing
        // console.log("DEBUG: Model Resolution", {
        //     model,
        //     hasImageFiles: imageFiles.length,
        //     hasImageUrls: imageUrls.length,
        //     templateRef: template_reference_image,
        //     canvasFile: !!canvasFile,
        //     canvasUrl: !!canvasUrl
        // });

        // AUTO-SWITCH T2I Logic: Nano Banana only supports /edit endpoint (no base T2I)
        // If no input images are provided, switch to Seedream v4.5 for high quality T2I
        const hasInputImages = (imageFiles.length > 0 || imageUrls.length > 0 || template_reference_image || canvasFile || canvasUrl);
        if (model.includes("nano-banana") && !hasInputImages) {
            // console.log("Auto-switching T2I request from Nano Banana to Seedream v4.5 (Nano Banana only supports /edit)");
            model = "fal-ai/bytedance/seedream/v4.5/text-to-image";
        }

        // AUTO-SWITCH REMIX Logic: Flux does not support multi-image subject replacement easily.
        // If we have both a Template AND a Subject, we MUST use Nano Banana (Gemini) which supports this via /edit.
        if (!model.includes("nano-banana") && template_reference_image && (imageFiles.length > 0 || imageUrls.length > 0)) {
            // console.log("Auto-switching Remix request to Nano Banana (Flux lacks multi-image support)");
            model = "fal-ai/nano-banana-pro";
        }

        // console.log(`GENERATE: final model after mapping=${model}`);

        // Setup Supabase Admin (needed for both branches)
        const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
        const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
        const admin = createClient(supabaseUrl, serviceRole);



        // Check Credits and Auto-Recharge settings
        const { data: userProfile, error: profileErr } = await admin
            .from("profiles")
            .select("credits, role, plan, auto_recharge_enabled, auto_recharge_pack_id, auto_recharge_threshold")
            .eq("user_id", userId)
            .single();

        if (profileErr || !userProfile) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        const userCredits = userProfile.credits ?? 0;
        const IMAGE_COST = 3;
        const isAdmin = userProfile.role === "admin" || userProfile.role === "super_admin";

        // Admins bypass credit check
        if (!isAdmin && userCredits < IMAGE_COST) {
            return NextResponse.json({
                error: "Insufficient credits. Please upgrade or top up.",
                required: IMAGE_COST,
                available: userCredits,
                plan: userProfile.plan || "free"
            }, { status: 402 });
        }

        // --- BRANCH: FAL.AI MODELS ---
        if (model.startsWith("fal-ai/")) {
            // console.log(`Using Fal Model: ${model}`);

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

            let falImages: string[] = [];

            // 1. Check for Canvas Image (Edit Mode) - HIGHEST PRIORITY
            if (canvasFile) {
                const ab = await canvasFile.arrayBuffer();
                const filePath = `fal-uploads/${userId}/canvas-${Date.now()}.jpg`;
                const { error: uploadErr } = await admin.storage.from("generations").upload(filePath, Buffer.from(ab), { contentType: canvasFile.type || "image/jpeg", upsert: false });
                if (!uploadErr) {
                    const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
                    falImages.push(pubUrl.publicUrl);
                } else {
                    console.warn("Failed to upload canvas image for Fal:", uploadErr);
                }
            } else if (canvasUrl) {
                falImages.push(canvasUrl);
            }

            // 2. Upload all user provided image files
            for (const file of imageFiles) {
                const ab = await file.arrayBuffer();
                const filePath = `fal-uploads/${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const { error: uploadErr } = await admin.storage.from("generations").upload(filePath, Buffer.from(ab), { contentType: file.type || "image/jpeg", upsert: false });
                if (!uploadErr) {
                    const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
                    falImages.push(pubUrl.publicUrl);
                } else {
                    console.warn("Failed to upload reference image for Fal:", uploadErr);
                }
            }

            // 3. Append existing imageUrls
            for (const url of imageUrls) {
                if (!falImages.includes(url)) falImages.push(url);
            }

            // 4. Handle Logo
            let falLogoUrl: string | null = null;
            if (logoFile) {
                const ab = await logoFile.arrayBuffer();
                const filePath = `fal-uploads/${userId}/logo_${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
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

            // Fallback for DB logging backward compatibility 
            let refImageUrl = falImages.length > 0 ? falImages[0] : (template_reference_image || null);


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
                else if (ratio === "4:5") falImageSize = { width: 832, height: 1024 };
                else falImageSize = { width: 832, height: 1216 }; // Default
            } else {
                // Use Explicit Pixels for Flux
                if (ratio === "1:1") falImageSize = { width: 1024, height: 1024 };
                else if (ratio === "16:9") falImageSize = { width: 1216, height: 832 }; // Flux Optimized
                else if (ratio === "9:16") falImageSize = { width: 832, height: 1216 }; // Flux Optimized
                else if (ratio === "4:5") falImageSize = { width: 832, height: 1024 }; // Flux Optimized
                else if (ratio === "4:3") falImageSize = { width: 1024, height: 768 };
                else if (ratio === "3:4") falImageSize = { width: 768, height: 1024 };
                else if (ratio === "21:9") falImageSize = { width: 1536, height: 640 };
                else if (ratio === "9:21") falImageSize = { width: 640, height: 1536 };
                else if (typeof ratio === "string") falImageSize = ratio; // Fallback
            }

            // Enhance Prompt for Realism & Subject Consistency
            let finalFalPrompt = rawPrompt;
            let subjectInstruction = "";
            let remixNegativePrompt: string | undefined;

            // 1. Enforce Photorealism (Default) unless style overrides
            const isCartoon = rawPrompt.toLowerCase().includes("cartoon") || rawPrompt.toLowerCase().includes("illustration") || rawPrompt.toLowerCase().includes("anime") || rawPrompt.toLowerCase().includes("sketch");
            if (!isCartoon) {
                // Add specific camera specs to match System Prompt
                finalFalPrompt += ", shot on Canon 5D Mk IV, 85mm lens, f/1.8, sharp focus, cinematic lighting, photorealistic, hyper-realistic, 8k, master photography";
            }

            // 1.5 Context/Industry Shift (CRITICAL)
            if (industryIntent) {
                finalFalPrompt += ` [CONTEXT SHIFT]: Change the background and environment to match the industry: '${industryIntent}'. The scene must clearly represent a '${industryIntent}' business.`;

                // Aggressive Outfit Logic for blanks
                if (!subjectOutfit) {
                    finalFalPrompt += ` [AUTO-OUTFIT]: The subject's outfit is unspecified. You MUST generate professional attire appropriate for a '${industryIntent}'. Do NOT default to casual clothes.`;
                }
            }

            // 1.8 Business Genie Context Injection (Agentic Memory)
            const businessContext = await getBusinessContext(userId, admin);
            if (businessContext) {
                // console.log("Injecting Business Context for User:", userId);
                finalFalPrompt += `\n\n[BUSINESS BLUEPRINT CONTEXT - AGENTIC MEMORY]\n(Strictly adhere to the following brand guidelines):\n${businessContext}\n`;
            }

            let falStrength: number | undefined;
            let useSubjectFirst = false; // When true, subject is Image 1 (face preserved), template is Image 2

            // 2. Subject Lock Instructions (Eye Line / Angle)
            // FIRST: Check for SIMPLIFIED EDIT MODE (Library/Studio Edit)
            // If canvas_image is provided with no template, this is a simple edit - skip all complex logic
            const isSimplifiedEdit = isNano && !template_reference_image && (canvasFile || canvasUrl);

            if (isSimplifiedEdit) {
                // console.log("Using Simplified Direct Edit Prompt");
                finalFalPrompt = rawPrompt + ". Update this image based on the instruction but keep everything else exactly the same. Do not change the composition or background.";
                // No subjectInstruction, no FACE LOCK, no remix logic
                subjectInstruction = "";
                remixNegativePrompt = "";
            } else if (refImageUrl && subjectLock) {

                // DETECT REMIX MODE (Template + Subject)
                if (isNano && template_reference_image && refImageUrl !== template_reference_image) {

                    // 🚨 GLOBAL CHANGE: "PHOTOSHOP CUTOUT" MODE
                    // We now force the SUBJECT (refImageUrl) to be IMAGE 1 (The Base/Primary)
                    // and the TEMPLATE (template_reference_image) to be IMAGE 2 (The Style/Composition Ref).
                    // This tells the model: "Take Image 1 (Subject) and style it like Image 2 (Template)"
                    // which preserves the subject's identity MUCH better than the reverse.
                    useSubjectFirst = true;

                    /* 
                       STRATEGY: 
                       1. Subject is BASE (Image 1). 
                       2. Template is REFERENCE (Image 2).
                       3. We instruct the model to "Keep the subject from Image 1, but replace the background/outfit to match Image 2".
                    */

                    console.log("=== HIGH-FIDELITY CUTOUT MODE ===");
                    console.log("Subject (Image 1):", refImageUrl?.slice(0, 50));
                    console.log("Template (Image 2):", template_reference_image?.slice(0, 50));

                    subjectInstruction = " [STRICT IDENTITY LOCK - PHOTOSHOP CUTOUT MODE] ";
                    subjectInstruction += " 1. CRITICAL TASK: You are a professional retoucher. You must CUT OUT the person from Image 1 (The Subject) and composite them into the scene defined by Image 2 (The Template). ";
                    subjectInstruction += " 2. FACE LOCK: The face in the final image MUST BE AN EXACT PIXEL-PERFECT MATCH to the person in Image 1. DO NOT GENERATE A NEW FACE. DO NOT MORPH THE FACE. ";
                    subjectInstruction += " 3. NO BEAUTIFICATION: Do not smooth the skin, change features, or apply 'AI filters'. Keep the original skin texture, moles, and imperfections from Image 1. ";
                    subjectInstruction += " 4. POSE & PROP MATCH: The subject must mimic the EXACT POSE and ACTION of the reference person in Image 2 (The Template). If Image 2 shows the person holding an object (e.g. phone, cup, tool), the NEW subject MUST hold that same object in the same way. ";
                    subjectInstruction += " 5. EXPRESSION LOCK: You MUST preserve the EXACT facial expression, mouth shape, and emotion from Image 1. Do NOT force a smile. Do NOT change the mood. ";
                    subjectInstruction += " 6. COMPOSITION: Use the background, lighting, and composition of Image 2. Discard the background from Image 1 completely. ";
                    subjectInstruction += " 7. BLENDING: The subject should look like they are standing in the scene of Image 2. Match the lighting direction and color tone of Image 2 on the subject's body, but KEEP THE FACE IDENTICAL to Image 1. ";

                    remixNegativePrompt = "smiling, forced smile, open mouth, happy, changing expression, changing mood, different emotion, bad hands, fused fingers, too many fingers, mutation, mutated hands, claw, malformed hands, missing limb, floating limbs, disconnected limbs, close up, extreme close up, zooming in, face filling screen, covering text, blocking text, text overlay, cartoon, illustration, 3d render, plastic, fake, distorted face, bad anatomy, ghosting, double exposure, blurry, pixelated, low resolution, bad lighting, makeup, face paint, wax figure, mannequin, doll-like, synthetic skin, dead eyes, deformed hands, extra fingers, missing fingers, mismatched skin tone, mask effect, head on wrong body, different skin color hands neck";

                    // Outfit Logic with Subject-First Strategy
                    if (keepOutfit) {
                        // Keep Outfit -> Lower strength allows the original pixels (Image 1) to shine through
                        console.log("CUTOUT BRANCH: keepOutfit=true → Preserving Image 1 pixels");
                        subjectInstruction += " 6. OUTFIT: Keep the Subject's EXACT outfit from Image 1. Do not change their clothing. ";
                        falStrength = 0.85; // Lower strength = More original image
                    } else if (subjectOutfit) {
                        // Change Outfit -> Needs high strength to overwrite Image 1's clothes
                        console.log("CUTOUT BRANCH: subjectOutfit → Overwriting Image 1 clothes");
                        subjectInstruction += " 6. OUTFIT: REPLACEMENT REQUIRED. Ignore the clothing in Image 1. Generate the outfit described in the prompt. ";

                        const outfitLower = subjectOutfit.toLowerCase().trim();
                        const outfitPrefix = (outfitLower.startsWith("he is") || outfitLower.startsWith("she is") || outfitLower.startsWith("they are") || outfitLower.startsWith("wearing"))
                            ? subjectOutfit
                            : `The person is wearing ${subjectOutfit}`;
                        finalFalPrompt = `${outfitPrefix}. ` + finalFalPrompt;

                        falStrength = 0.95; // High strength to force change
                    } else {
                        // Match Template -> Needs VERY high strength to overwrite Image 1's clothes with Image 2's style
                        console.log("CUTOUT BRANCH: Match Template → Overwriting Image 1 clothes");
                        subjectInstruction += " 6. OUTFIT: REPLACEMENT REQUIRED. The subject must wear the outfit shown in the 'Template Reference' (Image 2). Match the clothing style and color of Image 2. ";
                        subjectInstruction += " 7. IGNORE TEMPLATE FACE: Do NOT copy the face, expression, or age of the person in Image 2. The face must remain the person from Image 1. ";

                        // Explicitly describe the template outfit in the main prompt to help the model
                        finalFalPrompt = "The person is wearing the same outfit as the character in the Template Reference (Image 2). " + finalFalPrompt;

                        falStrength = 0.93; // Reduced from 1.0 to allow some image structure retention and better face lock
                    }

                } else {
                    // STANDARD / GENERIC LOGIC
                    if (keepOutfit) {
                        subjectInstruction += " PRESERVE OUTFIT: Keep the subject's clothing exactly as it is in the reference image. ";
                    } else if (subjectOutfit) {
                        subjectInstruction += ` OUTFIT: The Subject MUST be wearing: "${subjectOutfit}". `;
                    }
                    subjectInstruction += " FACE LOCK: Maintain the exact eye line, camera angle, and facial identity of the subject. ";
                }

            } else if (refImageUrl) {
                // For non-subject-lock flows with a reference, add FACE LOCK
                subjectInstruction += " FACE LOCK: Maintain the exact eye line, camera angle, and facial identity of the subject. ";
            }

            // Prepend instructions (only if we have any)
            if (subjectInstruction) {
                finalFalPrompt = subjectInstruction + finalFalPrompt;
            }




            // 3. Text Rendering Instructions (Crucial for Remix)
            if (headline || subheadline || cta || promotion || businessName) {

                let textPrompt = " [TEXT & LOGO REPLACEMENT MANDATE]: You must REPLACE the text in the original image with the new text provided below. Do NOT render the original text. ";
                textPrompt += " Render the new text clearly and professionally, using MODERN SANS-SERIF FONTS, High Contrast, and Professional Graphic Design principles. The text must be legible and stand out against the background. ";

                if (headline) textPrompt += `Headline: "${headline}". `;
                if (subheadline) textPrompt += `Subhead: "${subheadline}". `;
                if (cta) textPrompt += `Button/CTA: "${cta}". `;
                if (promotion) textPrompt += `Offer: "${promotion}". `;
                if (businessName) textPrompt += `Business Name: "${businessName}". `;

                textPrompt += "Typography must be legible, sharp, and integrated into the scene. ";

                // Append general text instructions
                finalFalPrompt += textPrompt;

                // LOGO LOGIC (Moved to START of Prompt for Visibility)
                if (falLogoUrl) {
                    finalFalPrompt = " [LOGO MANDATE] You MUST place the final reference image (the Logo) onto the design. Maintain its aspect ratio and place it prominently. " + finalFalPrompt;
                } else if (!logoFile && !logoUrl && businessName) {
                    // FIRE LOGO PROMPT - Prepend to ensure model prioritizes the overlay
                    const logoPrompt = ` COMPOSITION PRIORITY: Start by placing a clean, vector-style logo for '${businessName}' in the top-right corner. It must be a distinct, white or black graphic overlay. `;
                    finalFalPrompt = logoPrompt + finalFalPrompt;
                }
            } else if (industryIntent) {
                // User changed industry but didn't provide new text - auto-update text to match
                let autoTextPrompt = ` [AUTO-TEXT FOR INDUSTRY CHANGE]: The business type has changed to '${industryIntent}'. `;
                autoTextPrompt += ` You MUST update any visible text, headlines, and logos in the image to match the new '${industryIntent}' industry. `;
                autoTextPrompt += ` Generate a professional headline, business name, and logo that fits the '${industryIntent}' context. `;
                autoTextPrompt += ` Do NOT keep the original template's text - replace it with text appropriate for '${industryIntent}'. `;
                autoTextPrompt += ` Typography must be legible, sharp, and match the new industry aesthetic. `;
                finalFalPrompt += autoTextPrompt;
            }


            try {
                // Strength Logic: If Industry Intent (Background Change) is active, lower strength to allow Hallucination
                // falStrength already declared above
                let finalKeepOutfit = keepOutfit;

                if (industryIntent) {
                    falStrength = 0.85;
                    // CRITICAL: If changing industry (e.g. to Chef), we MUST allow outfit changes.
                    // If we strictly keep outfit, they will wear a t-shirt in a kitchen.
                    // So we disable strict outfit lock, and trust the prompt "ADAPT OUTFIT" which we added above.
                    finalKeepOutfit = false;

                    // Add explicit instruction if not already there
                    if (!finalFalPrompt.includes("ADAPT OUTFIT") && !finalFalPrompt.includes("AUTO-OUTFIT")) {
                        finalFalPrompt += ` [OUTFIT ADAPTATION]: The subject's clothing should remain similar in style but ADAPT to fit the '${industryIntent}' profession/vibe. If the new industry implies a uniform (e.g. Chef, Doctor, Firefighter), you MUST change the outfit to match.`;
                    }
                }

                // RESOLVE MAIN IMAGE (Prioritize Canvas for Edit Mode)
                const falMainImage = falImages.length > 0 ? falImages : (refImageUrl || null);
                // console.log("FAL GENERATION INPUTS:", { model, imageCount: falImages.length, template_reference_image, falStrength, finalKeepOutfit });

                const falImageUrl = await generateFalImage(model, finalFalPrompt, falImageSize, falMainImage, template_reference_image, finalKeepOutfit, remixNegativePrompt, falStrength, useSubjectFirst);
                // console.log("Fal Image Generated:", falImageUrl);

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

                // DEDUCT CREDITS (Exempt Admins)
                if (!isAdmin) {
                    const newBalance = userCredits - IMAGE_COST;
                    const { error: rpcErr } = await admin.rpc("decrement_credits", { x: IMAGE_COST, user_id_param: userId });
                    if (rpcErr) {
                        // Fallback if RPC missing
                        await admin.from("profiles").update({ credits: newBalance }).eq("user_id", userId);
                    }

                    // Trigger auto-recharge if enabled and below threshold
                    triggerAutoRechargeIfNeeded({
                        userId,
                        newBalance,
                        autoRechargeEnabled: userProfile.auto_recharge_enabled ?? false,
                        autoRechargePackId: userProfile.auto_recharge_pack_id ?? null,
                        autoRechargeThreshold: userProfile.auto_recharge_threshold ?? 10,
                    }).catch(err => console.error("[Auto-Recharge] Error:", err));
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

        // DEDUCT CREDITS (Vertex) - Exempt Admins
        if (!isAdmin) {
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
