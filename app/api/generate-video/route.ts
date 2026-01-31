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
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;

    console.log("Polling via fetchPredictOperation:", url);

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
            if (res.status === 404 && i < 5) {
                await new Promise(r => setTimeout(r, intervalMs));
                continue;
            }
            throw new Error(`Failed to poll operation: ${res.status}`);
        }

        const data = await res.json();
        // console.log(`Poll attempt ${i + 1}: done=${data.done}`);

        if (data.done) {
            if (data.error) {
                // Handle harmless "Service Unavailable" errors gracefully
                if (data.error.code === 14 || data.error.message?.includes("unavailable")) {
                    throw new Error("Video service is currently busy. Please try again in a moment.");
                }
                throw new Error(`Operation failed: ${data.error.message || JSON.stringify(data.error)}`);
            }
            // Log the raw response to debug "No video" issues
            console.log("Operation Done. Raw Response keys:", Object.keys(data.response || {}));
            if (!data.response?.videos && !data.response?.predictions) {
                console.error("FULL RAW RESPONSE:", JSON.stringify(data.response, null, 2));
            }
            return data.response;
        }

        await new Promise(r => setTimeout(r, intervalMs));
    }

    throw new Error("Operation timed out");
}

async function describeImage(
    projectId: string,
    location: string,
    token: string,
    imageBase64: string
): Promise<string> {
    try {
        const model = "gemini-3-pro-image-preview";
        // Use Global Endpoint for Preview Models
        const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

        const payload = {
            contents: [{
                role: "user",
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
                    { text: "Describe the environment, lighting, camera angle, and style of this image in detail. Output ONLY the visual description as a single paragraph. Do NOT use headers, markdown or conversational filler. Do NOT describe the characters. Focus on the scene." }
                ]
            }],
            generationConfig: { maxOutputTokens: 150 }
        };

        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.text();
            console.error(`Captioning Failed (${res.status}):`, err);
            return "";
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } catch (e) {
        console.error("Caption error:", e);
        return "";
    }
}

async function generateFalVideo(
    modelId: string, // e.g. "fal-ai/xai/grok-imagine-video/image-to-video"
    prompt: string,
    imageUrl?: string,
    videoUrl?: string,
    aspectRatio?: string
) {
    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("Missing FAL_KEY");

    const endpoint = `https://queue.fal.run/${modelId}`;

    // Default aspect ratio
    const ar = aspectRatio || "16:9";

    // Build payload with model-specific parameters
    const payload: any = {
        prompt,
        aspect_ratio: ar,
    };

    // Grok-specific: 8 second duration and 480p resolution (faster generation, can upscale on download)
    if (modelId.includes("grok")) {
        payload.duration = 8;
        payload.resolution = "480p";
    } else {
        payload.duration = 5; // Default for other models
    }

    if (imageUrl) payload.image_url = imageUrl;
    if (videoUrl) payload.video_url = videoUrl;

    console.log(`Fal Video Request (${modelId}):`, { prompt, ar, hasImage: !!imageUrl, hasVideo: !!videoUrl });

    // 1. Submit
    const res = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Fal Request Failed: ${res.status} ${err}`);
    }

    const { request_id } = await res.json();
    console.log("Fal Request ID:", request_id);

    // 2. Poll (10 mins max for video generation - Grok 10s videos take longer)
    let attempts = 0;
    const maxAttempts = modelId.includes("grok") ? 600 : 300; // 10 min for Grok, 5 min for others
    while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 1000));

        const statusRes = await fetch(`https://queue.fal.run/${modelId}/requests/${request_id}`, {
            headers: { "Authorization": `Key ${falKey}` },
        });

        if (!statusRes.ok) continue;

        const statusJson = await statusRes.json();

        // Log progress every 10 seconds
        if (attempts % 10 === 0) {
            console.log(`Fal Poll ${attempts}s: status=${statusJson.status}`);
        }

        if (statusJson.status === "COMPLETED") {
            const videoUrl = statusJson.video?.url || statusJson.video_url?.url || statusJson.images?.[0]?.url; // Check structure
            // Kling usually returns `video: { url: ... }`
            if (!videoUrl) throw new Error("Fal completed but returned no video URL");
            return videoUrl;
        }
        if (statusJson.status === "IN_QUEUE" || statusJson.status === "IN_PROGRESS") continue;

        throw new Error(`Fal Generation Failed: ${JSON.stringify(statusJson)}`);
    }
    throw new Error(`Fal Timeout (${maxAttempts / 60} min)`);
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { image, prompt, dialogue, sourceImageId, inputVideo, mainSubjectBase64, secondarySubjectBase64, aspectRatio, promptId, modelId: requestedModelId } = body;

        // 1. Auth via Session
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = user.id;

        // Validate
        if (!prompt) {
            return NextResponse.json({ error: "Missing required field (prompt is required)" }, { status: 400 });
        }

        // Check Credits (Video Cost: 30)
        const adminAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: userProfile, error: profileErr } = await adminAuth
            .from("profiles")
            .select("credits, role")
            .eq("user_id", userId)
            .single();

        if (profileErr || !userProfile) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        const userCredits = userProfile.credits ?? 0;
        const VIDEO_COST = 30;

        if (userCredits < VIDEO_COST) {
            return NextResponse.json({
                error: "Insufficient credits for video. Please upgrade or top up.",
                required: VIDEO_COST,
                available: userCredits
            }, { status: 402 });
        }

        // --- BRANCH: FAL / GROK ---
        if (requestedModelId && (requestedModelId.startsWith("fal-ai/") || requestedModelId.startsWith("xai/") || requestedModelId.includes("grok"))) {
            // Map friendly IDs to actual Fal model paths
            let falModelId = requestedModelId;
            if (requestedModelId === "grok-imagine-video") {
                // Auto-switch to edit-video if video input provided
                falModelId = inputVideo
                    ? "fal-ai/xai/grok-imagine-video/edit-video"
                    : "fal-ai/xai/grok-imagine-video/image-to-video";
            }
            if (requestedModelId === "grok-video-edit") falModelId = "fal-ai/xai/grok-imagine-video/edit-video";

            console.log("Using Fal Model:", falModelId, inputVideo ? "(video-to-video edit)" : "(image-to-video)");

            // Prepare inputs
            // Image might be base64. Fal accepts data uri.
            let finalImageUrl = undefined;
            if (image) {
                if (image.startsWith("http")) finalImageUrl = image;
                else if (image.startsWith("data:")) finalImageUrl = image;
                // Else if base64 without prefix? Wrap it.
            }

            // Video Input
            let finalVideoUrl = inputVideo; // usually URL from frontend (or base64?)
            // Frontend sends URL for video input mostly.

            try {
                const generatedVideoUrl = await generateFalVideo(falModelId, prompt, finalImageUrl, finalVideoUrl, aspectRatio);

                // Fal returns a public URL (usually temporary). We should download and store it to Supabase Generatons bucket.
                console.log("Fal Video Generated:", generatedVideoUrl);

                // Download
                const vRes = await fetch(generatedVideoUrl);
                const vBlob = await vRes.blob();
                const vBuffer = Buffer.from(await vBlob.arrayBuffer());

                // Upload to Supabase
                const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
                const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
                const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

                const filePath = `videos/${userId}/${Date.now()}.mp4`;
                const { error: uploadError } = await admin.storage
                    .from("generations")
                    .upload(filePath, vBuffer, { contentType: "video/mp4", upsert: false });

                if (uploadError) throw uploadError;

                const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
                const videoUrl = pubUrl.publicUrl;

                // Save DB
                // Reuse or duplicate DB logic?
                // Let's duplicate briefly for simplicity or refactor?
                // I will duplicate strictly the DB insert part for safety.

                // Thumbnail logic (simplified)
                let thumbnailUrl = image && image.startsWith("http") ? image : null;
                // If base64 image, we might want to upload it too? 
                // Existing logic handles base64 thumbnail upload.

                await admin.from("video_generations").insert({
                    user_id: userId,
                    source_image_id: sourceImageId || null,
                    prompt_id: promptId || null,
                    video_url: videoUrl,
                    thumbnail_url: thumbnailUrl,
                    prompt,
                    dialogue,
                    status: "completed",
                    is_public: true,
                    model: falModelId
                });

                // DEDUCT CREDITS (Fal)
                const { error: rpcErr } = await admin.rpc("decrement_credits", { x: VIDEO_COST, user_id_param: userId });
                if (rpcErr) {
                    await admin.from("profiles").update({ credits: userCredits - VIDEO_COST }).eq("user_id", userId);
                }

                return NextResponse.json({ videoUrl, model: falModelId, remainingCredits: userCredits - VIDEO_COST });

            } catch (e: any) {
                console.error("Fal Generation Error:", e);
                return NextResponse.json({ error: e.message || "Fal Generation Failed" }, { status: 500 });
            }
        }

        // --- BRANCH: VEO (Vertex AI) ---

        // 2. Setup Env & Auth
        const projectId = mustEnv("GOOGLE_CLOUD_PROJECT_ID");
        const location = "us-central1";

        // Use FAST model for Semantic Remix (Text-to-Video + Subject is cheaper/faster)
        const modelId = process.env.VEO_MODEL_ID || "veo-3.1-fast-generate-001";

        const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");

        // Debug: Show first 20 chars and their codes to diagnose JSON issues
        console.log("CREDS DEBUG: first 20 chars =", credsJson.slice(0, 20));
        console.log("CREDS DEBUG: char codes =", credsJson.slice(0, 10).split('').map(c => c.charCodeAt(0)));

        let credentials;
        try {
            credentials = JSON.parse(credsJson);
        } catch (e) {
            console.error("GOOGLE_APPLICATION_CREDENTIALS_JSON parse error:", e);
            throw new Error(`Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON: ${e}`);
        }

        const auth = new GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();

        // 3. Prepare Image (Start Frame)
        let imageBase64: string = "";
        let mimeType = "image/jpeg";
        let detectedAspectRatio = "16:9";

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

            try {
                const sharp = (await import("sharp")).default;
                const imageBuffer = Buffer.from(imageBase64, "base64");
                const metadata = await sharp(imageBuffer).metadata();

                if (metadata.width && metadata.height) {
                    const ratio = metadata.width / metadata.height;
                    // Veo Aspect Ratios
                    if (ratio >= 1.7) detectedAspectRatio = "16:9";
                    else if (ratio >= 1.3) detectedAspectRatio = "16:9";
                    else if (ratio <= 0.6) detectedAspectRatio = "9:16";
                    else if (ratio <= 0.8) detectedAspectRatio = "9:16";
                    else detectedAspectRatio = "1:1";

                    console.log(`Detected aspect ratio: ${metadata.width}x${metadata.height} -> ${detectedAspectRatio}`);
                }

                const maxDim = 1280;
                const resizedBuffer = await sharp(imageBuffer)
                    .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
                    .jpeg({ quality: 90 })
                    .toBuffer();
                imageBase64 = resizedBuffer.toString("base64");
                mimeType = "image/jpeg";
                console.log("Start Frame optimized:", imageBase64.length, "chars");
            } catch (e) {
                console.warn("Sharp optimization skipped:", e);
            }
        } else {
            console.log("Skipping image processing - extending video");
        }

        // 4. Build Request
        // Veo uses regional endpoint
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

        let finalPrompt = prompt + (dialogue ? ` Audio: "${dialogue}"` : "");
        let instancePayload: any = {};

        // SEMANTIC REMIX LOGIC:
        // If we have a Subject AND a Start Frame, we trigger Semantic Remix (Text-to-Video + Subject).
        const isSemanticRemix = !!image && !!mainSubjectBase64;

        if (isSemanticRemix) {
            console.log("Triggering Semantic Remix (Text-to-Video + Subject)...");

            // 1. Caption the Start Frame (Environment only)
            const sceneDescription = await describeImage(projectId, location, token.token!, imageBase64);
            console.log("Scene Context:", sceneDescription);

            // 2. Combine Prompts
            finalPrompt = `${finalPrompt}. Scene matching this description: ${sceneDescription}`;

            // 3. Set Payload (Text Only + Subject)
            instancePayload.prompt = finalPrompt;
            // Note: We deliberately OMIT instancePayload.image to force Text-to-Video mode
        } else {
            // Standard Flow (Image-to-Video or Video-to-Video)
            instancePayload.prompt = finalPrompt;

            if (inputVideo) {
                // Handle Video Input
                let videoBase64: string = "";
                let videoMime = "video/mp4";

                if (inputVideo.startsWith("http")) {
                    console.log("Fetching input video from URL...");
                    const vRes = await fetch(inputVideo);
                    if (!vRes.ok) throw new Error("Failed to fetch input video");
                    const vBuf = await vRes.arrayBuffer();
                    videoBase64 = Buffer.from(vBuf).toString("base64");
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
            } else if (imageBase64) {
                // Image-to-Video
                instancePayload.image = {
                    bytesBase64Encoded: imageBase64,
                    mimeType: mimeType
                };
            }
            // If neither video nor image, it's Text-to-Video
        }

        // NATIVE INGREDIENTS (Veo 3.1)
        if (mainSubjectBase64) {
            console.log("Adding Main Subject to payload (Native Veo Ingredients)...");

            let subjectBytes = "";
            let subjectMime = "image/jpeg";

            if (mainSubjectBase64.startsWith("data:")) {
                const match = mainSubjectBase64.match(/^data:(image\/\w+);base64,(.+)$/);
                if (match) {
                    // subjectMime = match[1];
                    subjectBytes = match[2];
                } else {
                    subjectBytes = mainSubjectBase64.split(",")[1] || mainSubjectBase64;
                }
            } else {
                subjectBytes = mainSubjectBase64;
            }

            // Optimize Subject Image
            try {
                const sharp = (await import("sharp")).default;
                const subjectBuffer = Buffer.from(subjectBytes, "base64");
                const resizedSubject = await sharp(subjectBuffer)
                    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
                    .jpeg({ quality: 90 })
                    .toBuffer();
                subjectBytes = resizedSubject.toString("base64");
                subjectMime = "image/jpeg"; // Sharp outputs jpeg
                console.log("Subject Image optimized:", subjectBytes.length, "chars");
            } catch (e) {
                console.warn("Subject optimization skipped:", e);
            }

            instancePayload.subjectReference = {
                bytesBase64Encoded: subjectBytes,
                mimeType: subjectMime
            };

            // Force prompt attention
            instancePayload.prompt += " (render the character from the subject reference)";
        }

        // Build parameters
        const gcsBucket = process.env.GCS_VIDEO_BUCKET || `${projectId}-veo-output`;
        const outputPath = `veo-output/${userId}/${Date.now()}.mp4`;
        const storageUri = `gs://${gcsBucket}/${outputPath}`;

        const durationSeconds = inputVideo ? 7 : 8;

        const parameters: any = {
            sampleCount: 1,
            durationSeconds,
            negativePrompt: "distortion, low quality, shaky, blurry",
            personGeneration: "allow_all",
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
            ],
            storageUri: storageUri
        };

        if (!inputVideo) {
            // Use client-provided aspect ratio if valid, otherwise fallback to detected (but avoid 1:1)
            let ratioToUse = aspectRatio || detectedAspectRatio;
            if (ratioToUse === "1:1" || ratioToUse === "4:5") {
                console.warn(`Unsupported video aspect ratio '${ratioToUse}', defaulting to 16:9`);
                ratioToUse = "16:9";
            }
            parameters.aspectRatio = ratioToUse;
        }

        console.log("Using GCS storageUri:", storageUri);

        const payload = {
            instances: [instancePayload],
            parameters
        };

        console.log("Starting Veo generation:", {
            modelId,
            promptLength: prompt.length,
            imageSize: imageBase64.length,
            storageUri,
            hasMainSubject: !!mainSubjectBase64,
            hasSecondarySubject: !!secondarySubjectBase64
        });

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

        // 6. Poll for Completion
        const response = await pollOperation(projectId, location, modelId, operationName, token.token!, 60, 5000);
        console.log("Operation complete");

        // 7. Extract Video
        const videos = response?.videos || [];
        const predictions = response?.predictions || [];

        let videoData: { gcsUri?: string; bytesBase64Encoded?: string } | null = null;
        if (videos.length > 0) videoData = videos[0];
        else if (predictions.length > 0) videoData = predictions[0];

        if (!videoData) {
            const safeResponse = JSON.stringify(response).slice(0, 1000); // Limit length
            console.error("No video in response:", safeResponse);
            return NextResponse.json({
                error: `No video returned. Backend Response: ${safeResponse}`
            }, { status: 502 });
        }

        // 8. Prepare Upload Body
        let uploadBody: Buffer | Blob;

        if (videoData.bytesBase64Encoded) {
            uploadBody = Buffer.from(videoData.bytesBase64Encoded, "base64");
        } else if (videoData.gcsUri) {
            console.log("Fetching video from GCS:", videoData.gcsUri);
            const gcsUrl = videoData.gcsUri.replace("gs://", "https://storage.googleapis.com/");
            const gcsRes = await fetch(gcsUrl, {
                headers: {
                    Authorization: `Bearer ${token.token}`
                }
            });
            if (!gcsRes.ok) {
                const gcsErr = await gcsRes.text();
                throw new Error(`Failed to fetch video from GCS: ${gcsRes.status}`);
            }
            uploadBody = await gcsRes.blob();
        } else {
            throw new Error("No video bytes or GCS URI in response");
        }

        // 8. Upload to Supabase
        const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
        const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
        const admin = createClient(supabaseUrl, serviceRole, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });

        const filePath = `videos/${userId}/${Date.now()}.mp4`;

        const { error: uploadError } = await admin.storage
            .from("generations")
            .upload(filePath, uploadBody as any, { contentType: "video/mp4", upsert: false, duplex: "half" });

        if (uploadError) {
            console.error("Upload error", uploadError);
            return NextResponse.json({ error: "Failed to save video" }, { status: 500 });
        }

        const { data: pubUrl } = admin.storage.from("generations").getPublicUrl(filePath);
        const videoUrl = pubUrl.publicUrl;

        // 9. Save DB Record
        let thumbnailUrl: string | null = null;
        if (image && (image.startsWith("http") || image.startsWith("https"))) {
            thumbnailUrl = image;
        } else if (image && image.startsWith("data:image")) {
            // Upload Thumbnail for Freestyle
            const thumbPath = `thumbnails/${userId}/${Date.now()}.jpg`;
            const base64Data = image.split(",")[1];
            const buffer = Buffer.from(base64Data, "base64");

            const { error: thumbErr } = await admin.storage
                .from("generations")
                .upload(thumbPath, buffer, { contentType: "image/jpeg", upsert: false });

            if (!thumbErr) {
                const { data: thumbPub } = admin.storage.from("generations").getPublicUrl(thumbPath);
                thumbnailUrl = thumbPub.publicUrl;
            }
        } else if (sourceImageId) {
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
            prompt_id: promptId || null, // NEW: Save linkage
            video_url: videoUrl,
            thumbnail_url: thumbnailUrl,
            prompt,
            dialogue,
            status: "completed",
            is_public: true
        });

        // DEDUCT CREDITS (Veo)
        const { error: rpcErr } = await admin.rpc("decrement_credits", { x: VIDEO_COST, user_id_param: userId });
        if (rpcErr) {
            await admin.from("profiles").update({ credits: userCredits - VIDEO_COST }).eq("user_id", userId);
        }

        return NextResponse.json({ videoUrl, model: modelId, remainingCredits: userCredits - VIDEO_COST });

    } catch (e: any) {
        console.error("Video Gen Error:", e);
        return NextResponse.json({ error: e.message || "Internal Error" }, { status: 500 });
    }
}
