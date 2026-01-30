import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";
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
            forceCutout = String(form.get("forceCutout") ?? "false").trim() === "true";
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

        // 3. ENV Setup
        const projectId = mustEnv("GOOGLE_CLOUD_PROJECT_ID");
        const location = (process.env.GOOGLE_CLOUD_LOCATION || "europe-west9").trim();

        const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
        let credentials;
        try {
            credentials = JSON.parse(credsJson);
        } catch {
            throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON");
        }

        const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
        const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
        const admin = createClient(supabaseUrl, serviceRole);

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

        const model = process.env.VERTEX_MODEL_ID || "gemini-3-pro-image-preview";
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

        // 6. Call Vertex with Retry Logic (Backoff)
        let res;
        let json;
        let attempts = 0;
        const maxAttempts = 2; // Strict limit to avoid Vercel 60s timeout

        while (attempts < maxAttempts) {
            try {
                res = await fetch(url, {
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

        return NextResponse.json({ imageUrl, fullQualityUrl: originalUrl }, { status: 200 });
    } catch (e: any) {
        console.error("GENERATE ERROR:", e);
        return NextResponse.json(
            { error: "server_error", message: e?.message || "Unexpected error" },
            { status: 500 }
        );
    }
}
