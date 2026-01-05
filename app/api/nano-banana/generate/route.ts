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
    const form = await req.formData();

    // What Vertex uses
    const rawPrompt = String(form.get("prompt") ?? "").trim();

    // Identity / context
    const userId = String(form.get("userId") ?? "").trim();
    const promptId = String(form.get("promptId") ?? "").trim() || null;
    const promptSlug = String(form.get("promptSlug") ?? "").trim() || null;

    const ar = (String(form.get("aspectRatio") ?? "9:16").trim() as AspectRatio) || "9:16";

    // Standardized prompt metadata (FINAL TEXT we want to store)
    const original_prompt_text = String(form.get("originalPrompt") ?? "").trim() || null;
    const remix_prompt_text = String(form.get("remixAdditions") ?? "").trim() || null;

    // Always store the final combined version that actually drove the generation
    const combined_prompt_text =
      String(form.get("combinedPromptText") ?? "").trim() ||
      rawPrompt ||
      null;

    if (!rawPrompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    // Pull up to 10 uploaded images
    const imageFiles = form.getAll("images").filter((v) => v instanceof File) as File[];
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
        return NextResponse.json({ error: "One of your images is too large. Max per image is 7MB." }, { status: 400 });
      }
    }
    if (total > MAX_TOTAL) {
      return NextResponse.json({ error: "Total upload too large. Max total is 20MB." }, { status: 400 });
    }

    const projectId = mustEnv("GOOGLE_CLOUD_PROJECT_ID");
    const location = (process.env.GOOGLE_CLOUD_LOCATION || "global").trim();

    const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
    const credentials = JSON.parse(credsJson);

    // Supabase (service role)
    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRole);

    // OAuth token for Vertex
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

    // Build multimodal parts
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
      return NextResponse.json({ error: "vertex_error", status: res.status, details: json }, { status: res.status });
    }

    // Extract inline image
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

    const { error: uploadError } = await admin.storage
      .from("generations")
      .upload(filePath, bytes, { contentType: outMime, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: pub } = admin.storage.from("generations").getPublicUrl(filePath);
    const imageUrl = pub.publicUrl;

    // Insert history
    try {
      await admin.from("prompt_generations").insert({
        user_id: userId,
        prompt_id: promptId,
        prompt_slug: promptSlug,
        image_url: imageUrl,

        // ✅ STANDARDIZED FINAL TEXT FIELDS
        original_prompt_text,
        remix_prompt_text,
        combined_prompt_text: combined_prompt_text || rawPrompt,

        settings: {
          aspectRatio: ar,
          model,
          provider: "vertex",
          input_images: imageFiles.length,

          // backup copy
          original_prompt_text,
          remix_prompt_text,
          combined_prompt_text: combined_prompt_text || rawPrompt,
        },
      });
    } catch (e) {
      console.error("prompt_generations insert failed:", e);
    }

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
