import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

type ReqBody = {
  prompt: string;
  aspectRatio?: AspectRatio;
  promptId?: string | null;
  promptSlug?: string | null;
  userId: string;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function aspectHint(aspectRatio: AspectRatio) {
  // We can’t send width/height in generationConfig for Vertex generateContent.
  // So we pass it as instruction text.
  switch (aspectRatio) {
    case "16:9":
      return "Output image in 16:9 landscape framing.";
    case "1:1":
      return "Output image in 1:1 square framing.";
    case "4:5":
      return "Output image in 4:5 portrait framing.";
    case "9:16":
    default:
      return "Output image in 9:16 vertical framing (TikTok/Reels style).";
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;

    const rawPrompt = (body.prompt ?? "").trim();
    const ar = body.aspectRatio ?? "9:16";

    if (!rawPrompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    if (!body.userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const projectId = mustEnv("GOOGLE_CLOUD_PROJECT_ID");
    const location = (process.env.GOOGLE_CLOUD_LOCATION || "global").trim();

    const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
    const credentials = JSON.parse(credsJson);

    // Supabase for uploads/history
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

    // Model (Vertex)
    const model = "gemini-3-pro-image-preview";

    const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    // ✅ Aspect ratio guidance passed as prompt instruction
    const finalPrompt = `${rawPrompt}\n\n${aspectHint(ar)}\nNo text overlays.`;

    // ✅ generationConfig only supports text-related params here (no width/height)
    const payload = {
      contents: [{ role: "user", parts: [{ text: finalPrompt }] }],
      generationConfig: {
        temperature: 0.7,
      },
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
      return NextResponse.json(
        { error: "vertex_error", status: res.status, details: json },
        { status: res.status }
      );
    }

    // Extract inline image
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    const inline = Array.isArray(parts)
      ? parts.find(
          (p) =>
            p?.inlineData?.data &&
            String(p?.inlineData?.mimeType || "").startsWith("image/")
        )
      : null;

    if (!inline) {
      return NextResponse.json(
        { error: "No image returned", details: json },
        { status: 502 }
      );
    }

    const mimeType = String(inline.inlineData.mimeType);
    const base64 = String(inline.inlineData.data);

    const bytes = Buffer.from(base64, "base64");
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const filePath = `users/${body.userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("generations")
      .upload(filePath, bytes, { contentType: mimeType, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: pub } = admin.storage.from("generations").getPublicUrl(filePath);
    const imageUrl = pub.publicUrl;

    // Optional history insert
    try {
      await admin.from("prompt_generations").insert({
        user_id: body.userId,
        prompt_id: body.promptId ?? null,
        prompt_slug: body.promptSlug ?? null,
        image_url: imageUrl,
        settings: { aspectRatio: ar, model, provider: "vertex" },
      });
    } catch {
      // ignore if table isn't there yet
    }

    return NextResponse.json({ imageUrl }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: "server_error", message: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
