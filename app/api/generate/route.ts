import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const runtime = "nodejs";

const SYSTEM_CORE = `
[GLOBAL SYSTEM INSTRUCTIONS]
1. Reference-First Behavior: The first image provided (the Template) is the COMPOSITION BLUEPRINT. Maintain its framing/layout. Apply user instructions as edits to this blueprint. YOU ARE ALLOWED to change subject clothing, appearance, or background if explicitly requested.
2. Photorealism Default: Generate photorealistic, studio-quality results. Enhance texture, lighting, and detail. Avoid cartoonish or plastic looks unless requested.
3. Safe Rules: You may change clothing, background, lighting, and style. You must NOT change face geometry or distort the subject.
4. FRAMING ADAPTATION: If the Subject Reference pose differs significantly from the Template, you may adapt the composition/framing to fit the subject naturally.

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
- Completely replace the template's human subject with the uploaded subject.

[TEMPLATE SUBJECT NULLIFICATION]
- If a user uploads a subject photo, ignore the template’s human anatomy entirely.
- Do NOT transfer body, pose, limbs, clothing, or silhouette from the template subject.
- The template subject exists only as a spatial/layout guide.
- The uploaded subject must never be extended, completed, or re-rendered to match the template subject.

[COMPOSITE-FIRST RENDERING]
- Treat the uploaded subject as a 2D photographic cutout.
- Do not generate new pixels of the subject outside the uploaded image bounds.
- Allowed operations: crop, scale, rotate slightly, edge feather, shadow, lighting match.
- Forbidden operations: body generation, limb completion, uniform synthesis, face recreation.
- The uploaded subject must remain a 2D photographic cutout, not a 3D rendered person.
- COMPOSITING STRATEGY: You MUST hide missing body areas by cropping tighter, scaling the subject up, or placing them behind foreground elements (badges, text bars, gradients).
`;

const SYSTEM_NON_HUMAN_RULES = `
[STYLE & OBJECT REFERENCE]
1. The Uploaded Image is a REFERENCE for Style or Object.
2. If the user asks to replace an object, use the Uploaded Object as the source.
3. If the user asks for style transfer, apply the visual style of the Uploaded Image to the Template composition.
`;

const SUBJECT_LOCK_INSTRUCTIONS = `
[SUBJECT LOCK: ACTIVE]
- STRICTLY PRESERVE the Uploaded Subject's identity, clothing, body type, and pose.
- Treated as a Photoshop cutout: Only crop, scale, color-match, and shadow-match are allowed.
- NO RESYNTHESIS: Do not regenerate the subject. Do not change outfit or uniform.
- UNIFORM OVERRIDE: Even if the template shows a uniform, ignore it. Keep the subject's exact upload attire.
- SMART COMPOSITING: Anchor the subject to screen bottom or hide cut-off torso behind layout elements. Never generate fake limbs.
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
async function urlToBase64(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const ab = await res.arrayBuffer();
    return {
        data: Buffer.from(ab).toString("base64"),
        mimeType: res.headers.get("content-type") || "image/png"
    };
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
        let templateFile: File | null = null;
        let canvasFile: File | null = null;
        let userSubjectFile: File | null = null;
        let subjectLock = false;
        let industryIntent: string | null = null;
        let intentQueue: any[] = [];

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

            try {
                const q = String(form.get("intent_queue") ?? "");
                if (q) intentQueue = JSON.parse(q);
            } catch (e) {
                console.warn("Failed to parse intent_queue", e);
            }

            imageFiles = form.getAll("images") as File[];
            subjectLock = String(form.get("subjectLock") ?? "false").trim() === "true";
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
            subjectLock = String(body.subjectLock ?? "false").trim() === "true";
            industryIntent = String(body.industry_intent ?? "").trim() || null;
            intentQueue = body.intent_queue || [];
        }

        // 2. Validation
        if (!rawPrompt && (!Array.isArray(intentQueue) || intentQueue.length === 0)) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

        // Strict Edit Mode Validation
        if (Array.isArray(intentQueue) && intentQueue.length > 0 && !canvasFile) {
            return NextResponse.json({ error: "Edit Mode requires a valid Base Canvas Image." }, { status: 400 });
        }

        if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

        if (imageFiles.length > 10) {
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
        const location = (process.env.GOOGLE_CLOUD_LOCATION || "global").trim();

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
        const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;


        const imageParts: any[] = [];

        const isEditMode = (Array.isArray(intentQueue) && intentQueue.length > 0) || !!canvasFile;

        if (isEditMode) {
            // --- EDIT MODE ---
            // Must use Canvas Image. No Template.
            if (!canvasFile) {
                return NextResponse.json({ error: "Edit Mode requires a valid Base Canvas Image (canvas_image)." }, { status: 400 });
            }
            const data = await fileToBase64(canvasFile);
            imageParts.push({ inlineData: { mimeType: canvasFile.type, data } });

            // Also attach any additional images (reference style, object, etc)
            for (const f of imageFiles) {
                const d = await fileToBase64(f);
                imageParts.push({ inlineData: { mimeType: f.type, data: d } });
            }

        } else {
            // --- REMIX MODE ---
            // Inputs: Template (File or URL) + Optional User Subject

            // 1. Template Image
            if (templateFile) {
                const data = await fileToBase64(templateFile);
                imageParts.push({ inlineData: { mimeType: templateFile.type, data } });
            } else if (template_reference_image) {
                try {
                    const res = await fetch(template_reference_image);
                    if (res.ok) {
                        const arrayBuffer = await res.arrayBuffer();
                        const data = Buffer.from(arrayBuffer).toString("base64");
                        const mimeType = res.headers.get("content-type") || "image/jpeg";
                        imageParts.push({ inlineData: { mimeType, data } });
                    }
                } catch (e: any) {
                    console.error("Failed to fetch template_reference_image", e);
                }
            }

            // 2. User Subject Image (if provided)
            if (userSubjectFile) {
                const f: any = userSubjectFile; // safe cast to avoid TS 'never' issue
                const data = await fileToBase64(f);
                imageParts.push({ inlineData: { mimeType: f.type || "image/jpeg", data } });
            }
        }

        // 3. Add Logo Image (if present)
        let logoInstruction = "";
        if (logoFile) {
            const mimeType = String(logoFile.type || "image/png");
            if (mimeType.startsWith("image/")) {
                const data = await fileToBase64(logoFile);
                imageParts.push({ inlineData: { mimeType, data } });
                logoInstruction = "LOGO REPLACEMENT: The FINAL IMAGE in the input list is the LOGO. Replace the template's existing logo/brand text with this exact logo image. Maintain its aspect ratio.";
            }
        } else if (businessName) {
            logoInstruction = `LOGO GENERATION: Generate a professional logo for '${businessName}' and place it in the template's designated logo area.`;
        }

        // Fetch internal secret sauce
        let internalRules = "";
        let subjectMode = "non_human";

        if (promptId) {
            const { data: dbTemplate } = await admin
                .from("prompts")
                .select("system_rules, subject_mode")
                .eq("id", promptId)
                .maybeSingle();

            if (dbTemplate) {
                internalRules = dbTemplate.system_rules || "";
                subjectMode = dbTemplate.subject_mode || "non_human";
            }
        }

        const subjectRules = imageFiles.length > 0
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
            (subjectLock && imageFiles.length > 0) ? SUBJECT_LOCK_INSTRUCTIONS : "",
            bgSwapInstruction,
            editModeInstruction,
            logoInstruction,
            "---",
            "USER INSTRUCTIONS:",
            rawPrompt,
            "---",
            aspectHint(ar),
            "No text overlays.",
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
            generationConfig: { temperature: 0.7 },
        };

        // DEBUG: Output full payload
        console.log(JSON.stringify(payload, null, 2));

        // 6. Call Vertex
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token.token} `,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const json: any = await res.json();

        if (!res.ok) {
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

        // 8a. Upload Original (Full Quality)
        const originalExt = outMime.includes("png") ? "png" : outMime.includes("webp") ? "webp" : "jpg";
        const originalFilePath = `users/${userId}/${Date.now()}.${originalExt}`;

        const { error: uploadOriginalError } = await admin.storage
            .from("generations")
            .upload(originalFilePath, bytes, { contentType: outMime, upsert: false });

        if (uploadOriginalError) {
            console.error("Failed to upload original:", uploadOriginalError);
        }

        const { data: originalPub } = admin.storage.from("generations").getPublicUrl(originalFilePath);
        const originalUrl = originalPub.publicUrl;

        // 8b. Optimize with Sharp (webP)
        const optimizedBytes = await sharp(bytes)
            .resize({ width: 1080, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        const ext = "webp";
        const filePath = `users/${userId}/${Date.now()}_opt.${ext}`;

        // Upload Optimized
        const { error: uploadError } = await admin.storage
            .from("generations")
            .upload(filePath, optimizedBytes, { contentType: "image/webp", upsert: false });

        if (uploadError) {
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        const { data: pub } = admin.storage.from("generations").getPublicUrl(filePath);
        const imageUrl = pub.publicUrl;

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
                    input_images: imageFiles.length,
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
