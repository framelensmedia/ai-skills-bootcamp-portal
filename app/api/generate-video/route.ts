import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300; // Long-running operation may take time

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

async function pollOperation(
    projectId: string,
    location: string,
    modelId: string,
    operationName: string,
    token: string,
    maxAttempts: number = 60,
    intervalMs: number = 5000
): Promise<any> {
    // Veo uses fetchPredictOperation endpoint (POST with operationName in body)
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;

    for (let i = 0; i < maxAttempts; i++) {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ operationName })
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error(`Poll error (attempt ${i + 1}): ${res.status} - ${errText.slice(0, 200)}`);
            // On 404, the operation might still be initializing, continue polling
            if (res.status === 404 && i < 5) {
                await new Promise(r => setTimeout(r, intervalMs));
                continue;
            }
            throw new Error(`Failed to poll operation: ${res.status}`);
        }

        const data = await res.json();
        console.log(`Poll attempt ${i + 1}: done=${data.done}`);

        if (data.done) {
            if (data.error) {
                throw new Error(`Operation failed: ${JSON.stringify(data.error)}`);
            }
            return data.response;
        }

        await new Promise(r => setTimeout(r, intervalMs));
    }

    throw new Error("Operation timed out");
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { image, prompt, dialogue, sourceImageId } = body;

        // 1. Auth via Session
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = user.id;

        if (!image || !prompt) {
            return NextResponse.json({ error: "Missing required fields (image or prompt)" }, { status: 400 });
        }

        // 2. Setup Env & Auth
        const projectId = mustEnv("GOOGLE_CLOUD_PROJECT_ID");
        const location = "us-central1"; // Veo only available here

        const modelId = process.env.VEO_MODEL_ID || "veo-3.1-fast-generate-001";

        const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
        const credentials = JSON.parse(credsJson);

        const auth = new GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();

        // 3. Prepare Image
        let imageBase64: string;
        let mimeType = "image/jpeg";

        if (image.startsWith("http://") || image.startsWith("https://")) {
            console.log("Fetching image from URL...");
            const imgRes = await fetch(image);
            if (!imgRes.ok) throw new Error("Failed to fetch source image");

            const contentType = imgRes.headers.get("content-type") || "image/jpeg";
            mimeType = contentType.includes("png") ? "image/png" : "image/jpeg";

            const imgBuffer = await imgRes.arrayBuffer();
            imageBase64 = Buffer.from(imgBuffer).toString("base64");
        } else if (image.startsWith("data:")) {
            const match = image.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                imageBase64 = match[2];
            } else {
                imageBase64 = image.split(",")[1] || image;
            }
        } else {
            imageBase64 = image;
        }

        // Resize for optimal Veo input
        try {
            const sharp = (await import("sharp")).default;
            const imageBuffer = Buffer.from(imageBase64, "base64");
            const resizedBuffer = await sharp(imageBuffer)
                .resize(1280, 720, { fit: "inside", withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toBuffer();
            imageBase64 = resizedBuffer.toString("base64");
            mimeType = "image/jpeg";
            console.log("Image optimized:", imageBase64.length, "chars");
        } catch (e) {
            console.warn("Sharp optimization skipped:", e);
        }

        // 4. Build Request
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

        const payload = {
            instances: [
                {
                    prompt: prompt + (dialogue ? ` Audio: "${dialogue}"` : ""),
                    image: {
                        bytesBase64Encoded: imageBase64,
                        mimeType: mimeType
                    }
                }
            ],
            parameters: {
                aspectRatio: "16:9",
                sampleCount: 1,
                durationSeconds: 6,
                negativePrompt: "distortion, low quality, shaky, blurry",
                personGeneration: "allow_adult"
            }
        };

        console.log("Starting Veo generation:", { modelId, promptLength: prompt.length, imageSize: imageBase64.length });

        // 5. Start Operation
        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token.token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error("Veo Start Error:", res.status, errText);
            return NextResponse.json({ error: `Veo Generation Failed: ${res.status}`, details: errText }, { status: res.status });
        }

        const operationData = await res.json();
        const operationName = operationData.name;
        console.log("Operation started:", operationName);

        // 6. Poll for Completion using fetchPredictOperation
        const response = await pollOperation(projectId, location, modelId, operationName, token.token!, 60, 5000);
        console.log("Operation complete");

        // 7. Extract Video
        // Response can have videos array with gcsUri OR bytesBase64Encoded
        const videos = response?.videos || [];
        const predictions = response?.predictions || [];

        let videoData: { gcsUri?: string; bytesBase64Encoded?: string } | null = null;

        if (videos.length > 0) {
            videoData = videos[0];
        } else if (predictions.length > 0) {
            videoData = predictions[0];
        }

        if (!videoData) {
            console.error("No video in response:", JSON.stringify(response).slice(0, 500));
            return NextResponse.json({ error: "No video returned from model" }, { status: 502 });
        }

        let videoBuffer: Buffer;

        if (videoData.bytesBase64Encoded) {
            videoBuffer = Buffer.from(videoData.bytesBase64Encoded, "base64");
        } else if (videoData.gcsUri) {
            // Fetch from GCS
            console.log("Fetching video from GCS:", videoData.gcsUri);
            const gcsRes = await fetch(videoData.gcsUri.replace("gs://", "https://storage.googleapis.com/"));
            if (!gcsRes.ok) throw new Error("Failed to fetch video from GCS");
            const gcsBuffer = await gcsRes.arrayBuffer();
            videoBuffer = Buffer.from(gcsBuffer);
        } else {
            throw new Error("No video bytes or GCS URI in response");
        }

        // 8. Upload to Supabase
        const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
        const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
        const admin = createClient(supabaseUrl, serviceRole);

        const filePath = `videos/${userId}/${Date.now()}.mp4`;

        const { error: uploadError } = await admin.storage
            .from("generations")
            .upload(filePath, videoBuffer, { contentType: "video/mp4", upsert: false });

        if (uploadError) {
            console.error("Upload error", uploadError);
            return NextResponse.json({ error: "Failed to save video" }, { status: 500 });
        }

        const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
        const videoUrl = pubUrl.publicUrl;

        // 9. Save DB Record
        await admin.from("video_generations").insert({
            user_id: userId,
            source_image_id: sourceImageId || null,
            video_url: videoUrl,
            prompt,
            dialogue,
            status: "completed"
        });

        return NextResponse.json({ videoUrl, model: modelId });

    } catch (e: any) {
        console.error("Video Gen Error:", e);
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
