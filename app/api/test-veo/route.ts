import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

function mustEnv(name: string) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}

function stripBase64(obj: any): any {
    if (!obj) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripBase64);

    const newObj: any = {};
    for (const key in obj) {
        if (key === 'bytesBase64Encoded' && typeof obj[key] === 'string' && obj[key].length > 100) {
            newObj[key] = `<base64_hidden length=${obj[key].length}>`;
        } else {
            newObj[key] = stripBase64(obj[key]);
        }
    }
    return newObj;
}

// Basic polling helper
async function pollOperation(
    projectId: string,
    location: string,
    modelId: string,
    operationName: string,
    token: string
): Promise<any> {
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;

    for (let i = 0; i < 60; i++) { // 5 min timeout
        const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ operationName })
        });

        if (!res.ok) throw new Error(`Poll failed: ${res.status}`);

        const data = await res.json();
        console.log(`Poll ${i}: done=${data.done}`);

        if (data.done) {
            if (data.error) throw new Error(JSON.stringify(data.error));
            return data.response;
        }
        await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error("Timeout");
}

async function describeImage(
    projectId: string,
    location: string,
    token: string,
    imageBase64: string,
    type: "scene" | "character" | "style" = "scene"
): Promise<string> {
    try {
        // MATCH PRODUCTION: Use Gemini 3 Preview Model (Global Endpoint)
        const model = "gemini-3-pro-image-preview";
        const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

        let promptText = "";
        if (type === "scene") {
            promptText = "Describe the environment, lighting, camera angle, and style of this image in detail. Output ONLY the visual description as a single paragraph. Do NOT use headers, markdown or conversational filler. Do NOT describe the characters. Focus on the scene.";
        } else if (type === "style") {
            promptText = "Describe the visual style, art direction, color palette, lighting, and mood of this image. Do not describe the content, focus on the AESTHHETICS and STYLE. Output ONLY the description as a single paragraph.";
        } else {
            promptText = "Describe the main character in this image in detail: their physical appearance, clothing, hair, and distinct features. Output ONLY the visual description as a single paragraph. Do NOT use headers, markdown or conversational filler. Focus ONLY on the character.";
        }

        const payload = {
            contents: [{
                role: "user",
                parts: [
                    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
                    { text: promptText }
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
    } catch (e: any) {
        console.error("Caption error:", e);
        return "";
    }
}

export async function POST(req: Request) {
    let inputsReceived: any = {};
    let payload: any = {};
    let finalRes: any = {};

    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { prompt, modelId, contextImage, subjectImage, sendAsStartFrame, sendAsStyleRef, sendAsSubjectRef, aspectRatio, useSemanticRemix } = await req.json();

        // ...

        const parameters = {
            sampleCount: 1,
            durationSeconds: 8,
            personGeneration: "allow_all",
            aspectRatio: aspectRatio || "9:16", // Use provided or default
            negativePrompt: "distortion, low quality, shaky, blurry",
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
            ]
        };

        inputsReceived = {
            hasPrompt: !!prompt,
            contextImageLen: contextImage ? contextImage.length : 0,
            subjectImageLen: subjectImage ? subjectImage.length : 0,
            sendAsStartFrame,
            sendAsStyleRef,
            sendAsSubjectRef,
            useSemanticRemix
        };

        console.log("[Veo Lab] Request received:", inputsReceived);

        const projectId = mustEnv("GOOGLE_CLOUD_PROJECT_ID");
        const location = "us-central1";
        const selectedModel = modelId || "veo-3.1-generate-001"; // Default to Standard

        // Auth
        const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
        const auth = new GoogleAuth({
            credentials: JSON.parse(credsJson),
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();

        // Build Payload
        const instancePayload: any = { prompt };

        const pipelineStats: any = {};

        // Helper to optimize images
        const optimizeImage = async (input: string, label: string): Promise<{ data: string, mimeType: string } | null> => {
            try {
                let buffer;
                if (input.startsWith('http')) {
                    const res = await fetch(input);
                    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
                    const arrayBuffer = await res.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                    pipelineStats[`${label}_fetchSize`] = buffer.length;
                } else {
                    const base64Str = input.split(",")[1] || input;
                    buffer = Buffer.from(base64Str, "base64");
                    pipelineStats[`${label}_inputBase64Size`] = buffer.length;
                }

                const sharp = (await import("sharp")).default;
                const metadata = await sharp(buffer).metadata();
                pipelineStats[`${label}_originalDims`] = `${metadata.width}x${metadata.height}`;

                let mimeType = "image/jpeg";
                if (metadata.format === "png") mimeType = "image/png";
                if (metadata.format === "webp") mimeType = "image/webp";

                // BYPASS OPTIMIZATION ONLY IF:
                // 1. File size is small (< 5MB)
                // 2. Dimensions are reasonable (< 1536x1536)
                // Large dimensions (e.g. 4000px) can cause model failures even if file size is small.
                const isSmallEnough = buffer.length < 5 * 1024 * 1024;
                const isDimensionSafe = metadata.width && metadata.width <= 1536 && metadata.height && metadata.height <= 1536;

                if (isSmallEnough && isDimensionSafe) {
                    pipelineStats[`${label}_action`] = "skipped_optimization_raw_send";
                    pipelineStats[`${label}_optimizedSize`] = buffer.length;
                    return { data: buffer.toString("base64"), mimeType };
                }

                // OTHERWISE: Resize to standard 1280px (MATCH PRODUCTION EXACTLY)
                const resized = await sharp(buffer)
                    .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
                    .jpeg({ quality: 90 }) // MATCH PRODUCTION (was 95, reverting to 90)
                    .toBuffer();

                const resizedMeta = await sharp(resized).metadata();
                pipelineStats[`${label}_action`] = `resized_${resizedMeta.width}x${resizedMeta.height}`;
                pipelineStats[`${label}_optimizedSize`] = resized.length;
                return { data: resized.toString("base64"), mimeType: "image/jpeg" };
            } catch (e: any) {
                console.warn(`[${label}] Image optimization failed:`, e);
                pipelineStats[`${label}_error`] = e.message;
                return null;
            }
        };

        // Context Image Handling
        let contextDescription = "";

        if (contextImage) {
            const result = await optimizeImage(contextImage, "context");
            if (result) {
                const { data: clean, mimeType } = result;

                if (useSemanticRemix) {
                    // MVP V3: "Scanner Mode" for Context
                    // 1. Describe the STYLE of the scene (Thumbnail) as user requested
                    console.log("Semantic Remix: Describing context style...");
                    contextDescription = await describeImage(projectId, location, token.token!, clean, "style");
                    pipelineStats["context_description"] = contextDescription;

                    // NOTE: We do NOT set instancePayload.image here.
                    // The user wants the SUBJECT image to be the Start Frame.
                    // The Context Image is used ONLY for the description above.

                } else if (sendAsStartFrame) {
                    // STANDARD: Image-to-Video
                    instancePayload.image = {
                        bytesBase64Encoded: clean,
                        mimeType: mimeType
                    };
                }

                if (sendAsStyleRef) {
                    instancePayload.styleReference = {
                        bytesBase64Encoded: clean,
                        mimeType: mimeType
                    };
                }
            }
        }

        if (subjectImage && sendAsSubjectRef) {
            const result = await optimizeImage(subjectImage, "subject");
            if (result) {
                const { data: clean, mimeType } = result;

                if (useSemanticRemix) {
                    // MVP V3: Subject becomes Start Frame
                    // We hijack the "Start Frame" slot with the Subject Image
                    instancePayload.image = {
                        bytesBase64Encoded: clean,
                        mimeType: mimeType
                    };

                    // MVP Remix Prompt strategy (Pure Text Control):
                    // "Visual Style: [Desc]. User Action: [Prompt]"
                    if (contextDescription) {
                        instancePayload.prompt = `Visual Style: ${contextDescription}. Action: ${prompt} (maintain this style but perform this action)`;
                    } else {
                        instancePayload.prompt = prompt;
                    }

                    // Note: No "Subject Reference" ingredients sent.

                } else {
                    // Standard Flow: Send Ingredients + Suffix
                    instancePayload.subjectReference = {
                        bytesBase64Encoded: clean,
                        mimeType: mimeType
                    };

                    // Standard Flow Suffix
                    instancePayload.prompt += " (render the character from the subject reference)";
                }
            }
        }

        // ... (parameters)

        // ... (payload)

        // ... (api call)

        // ... (poll)

        const payload = {
            instances: [instancePayload],
            parameters
        };

        inputsReceived.pipelineStats = pipelineStats; // Attach stats to inputs for tracking

        console.log(`[Veo Lab] Calling ${modelId}`);

        // 5. Start Operation
        const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;

        const startRes = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!startRes.ok) {
            const err = await startRes.text();
            return NextResponse.json({ error: `Start failed: ${startRes.status}`, details: err }, { status: startRes.status });
        }

        const opData = await startRes.json();
        finalRes = await pollOperation(projectId, location, modelId, opData.name, token.token!);

        // Extract Video
        const videoData = finalRes.videos?.[0] || finalRes.predictions?.[0];

        if (!videoData) {
            console.error("No video in response. Raw:", JSON.stringify(finalRes));
            return NextResponse.json({
                success: false,
                error: "No video in Google response (Safety Block?)",
                rawGoogleResponse: stripBase64(finalRes),
                payloadSent: stripBase64(payload),
                inputsReceived
            });
        }

        // Use GCS URI if available
        let videoUrl = "";
        let videoBuffer;

        if (videoData.bytesBase64Encoded) {
            videoBuffer = Buffer.from(videoData.bytesBase64Encoded, "base64");
        } else if (videoData.gcsUri) {
            const gcsUrl = videoData.gcsUri.replace("gs://", "https://storage.googleapis.com/");
            const gcsRes = await fetch(gcsUrl, { headers: { Authorization: `Bearer ${token.token}` } });
            videoBuffer = await gcsRes.blob();
        } else {
            return NextResponse.json({
                success: false,
                error: "Video data missing bytes/uri",
                rawGoogleResponse: stripBase64(finalRes),
                payloadSent: stripBase64(payload),
                inputsReceived
            });
        }

        const filePath = `lab/${Date.now()}.mp4`;
        const admin = createClient(mustEnv("NEXT_PUBLIC_SUPABASE_URL"), mustEnv("SUPABASE_SERVICE_ROLE_KEY"));
        const { error: uploadError } = await admin.storage.from("generations").upload(filePath, videoBuffer as any, { contentType: "video/mp4" });

        if (uploadError) {
            const size = Buffer.isBuffer(videoBuffer) ? videoBuffer.length : (videoBuffer as any).size;
            throw new Error(`Supabase Upload Failed: ${uploadError.message} (Size: ${size})`);
        }

        const { data: pub } = admin.storage.from("generations").getPublicUrl(filePath);

        return NextResponse.json({
            success: true,
            videoUrl: pub.publicUrl,
            inputsReceived,
            payloadSent: stripBase64(payload),
            rawGoogleResponse: stripBase64(finalRes)
        });

    } catch (e: any) {
        console.error("Lab Error:", e);
        return NextResponse.json({
            success: false,
            error: e.message || "Unknown Lab Error",
            details: e,
            inputsReceived,
            payloadSent: stripBase64(payload),
            rawGoogleResponse: stripBase64(finalRes)
        }, { status: 200 });
    }
}
