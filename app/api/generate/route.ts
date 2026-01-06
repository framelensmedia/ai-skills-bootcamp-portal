import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

        let imageFiles: File[] = [];

        // 1. Parse Input
        if (contentType.includes("multipart/form-data")) {
            const form = await req.formData();

            rawPrompt = String(form.get("prompt") ?? "").trim();
            userId = String(form.get("userId") ?? "").trim();
            promptId = String(form.get("promptId") ?? "").trim() || null;
            promptSlug = String(form.get("promptSlug") ?? "").trim() || null;
            ar = (String(form.get("aspectRatio") ?? "9:16").trim() as AspectRatio) || "9:16";

            original_prompt_text = String(form.get("original_prompt_text") ?? "").trim() || null;
            remix_prompt_text = String(form.get("remix_prompt_text") ?? "").trim() || null;
            combined_prompt_text =
                String(form.get("combined_prompt_text") ?? "").trim() || rawPrompt || null;

            imageFiles = form.getAll("images").filter((v) => v instanceof File) as File[];
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
            // but that's okay, it's optional meta.
        }

        // 2. Validation
        if (!rawPrompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
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

        // Handle CREDENTIALS_JSON potentially being a string or already broken lines
        // Ideally it's a single line JSON string in env var
        const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
        let credentials;
        try {
            credentials = JSON.parse(credsJson);
        } catch {
            // Some users put file path or malformed json
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

        const model = "gemini-3-pro-image-preview";
        const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

        // 5. Construct Prompt
        const finalPrompt = [
            rawPrompt,
            "",
            aspectHint(ar),
            "No text overlays.",
            imageFiles.length
                ? "Use the uploaded reference image(s) as visual guidance. Keep the composition consistent when appropriate."
                : "",
        ]
            .filter(Boolean)
            .join("\n");

        const imageParts: any[] = [];
        for (const f of imageFiles) {
            const mimeType = String(f.type || "image/png");
            if (!mimeType.startsWith("image/")) continue;
            const data = await fileToBase64(f);
            imageParts.push({ inlineData: { mimeType, data } });
        }

        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [...imageParts, { text: finalPrompt }],
                },
            ],
            generationConfig: { temperature: 0.7 },
        };

        // 6. Call Vertex
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token.token}`,
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
        const ext = outMime.includes("png") ? "png" : outMime.includes("webp") ? "webp" : "jpg";
        const filePath = `users/${userId}/${Date.now()}.${ext}`;

        // 8. Upload to Supabase Storage
        const { error: uploadError } = await admin.storage
            .from("generations")
            .upload(filePath, bytes, { contentType: outMime, upsert: false });

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
                },
            });
        } catch (e) {
            console.error("prompt_generations insert failed:", e);
            // don't fail the request, just log it
        }

        return NextResponse.json({ imageUrl }, { status: 200 });
    } catch (e: any) {
        console.error("GENERATE ERROR:", e);
        return NextResponse.json(
            { error: "server_error", message: e?.message || "Unexpected error" },
            { status: 500 }
        );
    }
}
