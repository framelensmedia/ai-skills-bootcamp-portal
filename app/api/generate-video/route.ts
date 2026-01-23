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
        const { image, prompt, dialogue, sourceImageId, inputVideo } = body;

        // 1. Auth via Session
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = user.id;

        // Validate: must have either image or inputVideo, and must have prompt
        if ((!image && !inputVideo) || !prompt) {
            return NextResponse.json({ error: "Missing required fields (image/video and prompt required)" }, { status: 400 });
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

        // 3. Prepare Image (only if not extending a video)
        let imageBase64: string = "";
        let mimeType = "image/jpeg";
        let detectedAspectRatio = "16:9"; // Default fallback

        // Only process image if provided (not video extension)
        if (image) {
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

            // Detect aspect ratio and resize while preserving it
            try {
                const sharp = (await import("sharp")).default;
                const imageBuffer = Buffer.from(imageBase64, "base64");
                const metadata = await sharp(imageBuffer).metadata();

                if (metadata.width && metadata.height) {
                    const ratio = metadata.width / metadata.height;
                    // Map to Veo supported aspect ratios
                    if (ratio >= 1.7) { // ~16:9 (1.77)
                        detectedAspectRatio = "16:9";
                    } else if (ratio >= 1.3) { // ~4:3 (1.33)
                        detectedAspectRatio = "16:9"; // Veo may not support 4:3, use closest
                    } else if (ratio <= 0.6) { // ~9:16 (0.56)
                        detectedAspectRatio = "9:16";
                    } else if (ratio <= 0.8) { // ~3:4 (0.75)
                        detectedAspectRatio = "9:16"; // Veo may not support 3:4, use closest
                    } else {
                        detectedAspectRatio = "1:1"; // Square-ish
                    }
                    console.log(`Detected aspect ratio: ${metadata.width}x${metadata.height} -> ${detectedAspectRatio}`);
                }

                // Resize while maintaining aspect ratio
                const maxDim = 1280;
                const resizedBuffer = await sharp(imageBuffer)
                    .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
                    .jpeg({ quality: 90 })
                    .toBuffer();
                imageBase64 = resizedBuffer.toString("base64");
                mimeType = "image/jpeg";
                console.log("Image optimized:", imageBase64.length, "chars");
            } catch (e) {
                console.warn("Sharp optimization skipped:", e);
            }
        } else {
            console.log("Skipping image processing - extending video");
        }

        // 4. Build Request
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

        let instancePayload: any = {
            prompt: prompt + (dialogue ? ` Audio: "${dialogue}"` : "")
        };

        // inputVideo already extracted at top, use it here
        if (inputVideo) {
            // Handle Video Input (Extension/Edit)
            let videoBase64: string = "";
            let videoMime = "video/mp4";

            if (inputVideo.startsWith("http")) {
                console.log("Fetching input video from URL...");
                const vRes = await fetch(inputVideo);
                if (!vRes.ok) throw new Error("Failed to fetch input video");
                const vBuf = await vRes.arrayBuffer();
                videoBase64 = Buffer.from(vBuf).toString("base64");
                // verify mime? default to mp4
                const ct = vRes.headers.get("content-type");
                if (ct) videoMime = ct;
            } else if (inputVideo.startsWith("data:")) {
                const match = inputVideo.match(/^data:(video\/\w+);base64,(.+)$/);
                if (match) {
                    videoMime = match[1];
                    videoBase64 = match[2];
                } else {
                    videoBase64 = inputVideo.split(",")[1] || inputVideo;
                }
            } else {
                videoBase64 = inputVideo;
            }

            instancePayload.video = {
                bytesBase64Encoded: videoBase64,
                mimeType: videoMime
            };
        } else {
            // Fallback to Image (Text-to-Video / Image-to-Video)
            instancePayload.image = {
                bytesBase64Encoded: imageBase64,
                mimeType: mimeType
            };
        }

        // Build parameters - add storageUri for large outputs
        const gcsBucket = process.env.GCS_VIDEO_BUCKET || `${projectId}-veo-output`;
        const outputPath = `veo-output/${userId}/${Date.now()}.mp4`;
        const storageUri = `gs://${gcsBucket}/${outputPath}`;

        // Video extension only supports 7s duration; new videos can be 8s
        const durationSeconds = inputVideo ? 7 : 8;

        const parameters: any = {
            sampleCount: 1,
            durationSeconds,
            negativePrompt: "distortion, low quality, shaky, blurry",
            personGeneration: "allow_adult",
            storageUri: storageUri  // Required for large video outputs
        };

        // Only set aspectRatio for new video generation (not extensions)
        // For extensions, Veo auto-detects from the input video
        if (!inputVideo) {
            parameters.aspectRatio = detectedAspectRatio;
        }

        console.log("Using GCS storageUri:", storageUri);

        const payload = {
            instances: [instancePayload],
            parameters
        };

        console.log("Starting Veo generation:", { modelId, promptLength: prompt.length, imageSize: imageBase64.length, storageUri });
        console.log("Full payload:", JSON.stringify(payload, null, 2).slice(0, 1000));

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
            // Fetch from GCS with authentication
            console.log("Fetching video from GCS:", videoData.gcsUri);
            const gcsUrl = videoData.gcsUri.replace("gs://", "https://storage.googleapis.com/");
            const gcsRes = await fetch(gcsUrl, {
                headers: {
                    Authorization: `Bearer ${token.token}`
                }
            });
            if (!gcsRes.ok) {
                const gcsErr = await gcsRes.text();
                console.error("GCS fetch error:", gcsRes.status, gcsErr);
                throw new Error(`Failed to fetch video from GCS: ${gcsRes.status}`);
            }
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
        // Use source image as thumbnail for faster library loading
        let thumbnailUrl: string | null = null;
        if (image && image.startsWith("http")) {
            thumbnailUrl = image;
        } else if (sourceImageId) {
            // Try to get source image URL from DB
            const { data: sourceImg } = await admin
                .from("prompt_generations")
                .select("image_url")
                .eq("id", sourceImageId)
                .single();
            if (sourceImg?.image_url) {
                thumbnailUrl = sourceImg.image_url;
            }
        }

        await admin.from("video_generations").insert({
            user_id: userId,
            source_image_id: sourceImageId || null,
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            prompt,
            dialogue,
            status: "completed",
            is_public: true
        });

        return NextResponse.json({ videoUrl, model: modelId });

    } catch (e: any) {
        console.error("Video Gen Error:", e);
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
