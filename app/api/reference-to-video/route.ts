import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;

const VIDEO_COST = 30;

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
    token: string
): Promise<any> {
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`;
    const startTime = Date.now();
    const TIMEOUT_MS = 290_000;

    while (Date.now() - startTime < TIMEOUT_MS) {
        const res = await fetch(url, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ operationName }),
        });
        if (!res.ok) {
            const errText = await res.text();
            if (res.status === 404 && Date.now() - startTime < 30_000) {
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }
            throw new Error(`Poll error: ${res.status} — ${errText.slice(0, 200)}`);
        }
        const data = await res.json();
        if (data.done) {
            if (data.error) throw new Error(`Operation failed: ${data.error.message || JSON.stringify(data.error)}`);
            return data.response;
        }
        await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error("Operation timed out");
}

async function toBase64(input: string): Promise<{ bytes: string; mime: string }> {
    if (input.startsWith("data:")) {
        const match = input.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) return { bytes: match[2], mime: match[1] };
        return { bytes: input.split(",")[1] || input, mime: "image/jpeg" };
    }
    if (input.startsWith("http")) {
        const res = await fetch(input);
        if (!res.ok) throw new Error(`Failed to fetch reference image: ${res.status}`);
        const ct = res.headers.get("content-type") || "image/jpeg";
        const buf = await res.arrayBuffer();
        return { bytes: Buffer.from(buf).toString("base64"), mime: ct.split(";")[0] };
    }
    return { bytes: input, mime: "image/jpeg" };
}

export async function POST(req: Request) {
    try {
        const { prompt, referenceImages, aspectRatio = "16:9" } = await req.json();

        if (!prompt?.trim()) {
            return NextResponse.json({ error: "A prompt is required" }, { status: 400 });
        }
        if (!referenceImages?.length) {
            return NextResponse.json({ error: "At least one reference image is required" }, { status: 400 });
        }
        if (referenceImages.length > 3) {
            return NextResponse.json({ error: "Maximum 3 reference images allowed" }, { status: 400 });
        }

        // Auth
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const adminAuth = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: profile } = await adminAuth
            .from("profiles")
            .select("credits, role")
            .eq("user_id", user.id)
            .single();

        if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

        const isAdmin = ["admin", "super_admin"].includes(String(profile.role).toLowerCase());
        const credits = profile.credits ?? 0;

        if (!isAdmin && credits < VIDEO_COST) {
            return NextResponse.json({
                error: "Insufficient credits",
                required: VIDEO_COST,
                available: credits
            }, { status: 402 });
        }

        // Vertex AI Setup
        const projectId = mustEnv("GOOGLE_CLOUD_PROJECT_ID");
        const location = "us-central1";
        const modelId = "veo-3.1-fast-generate-001";

        const credsJson = mustEnv("GOOGLE_APPLICATION_CREDENTIALS_JSON");
        let credentials = JSON.parse(credsJson);
        if (credentials.private_key) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, "\n");
        }

        const auth = new GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });
        const authClient = await auth.getClient();
        const { token } = await authClient.getAccessToken();
        if (!token) throw new Error("Failed to get Google auth token");

        // Build referenceImages payload
        // Vertex AI format: { referenceType, image: { bytesBase64Encoded, mimeType } }
        const refImagePayloads = await Promise.all(
            referenceImages.map(async (img: string) => {
                const { bytes, mime } = await toBase64(img);
                // Optimize with sharp if available
                try {
                    const sharp = (await import("sharp")).default;
                    const buf = Buffer.from(bytes, "base64");
                    const optimized = await sharp(buf)
                        .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
                        .jpeg({ quality: 90 })
                        .toBuffer();
                    return {
                        referenceType: "asset",
                        image: {
                            bytesBase64Encoded: optimized.toString("base64"),
                            mimeType: "image/jpeg",
                        },
                    };
                } catch {
                    return {
                        referenceType: "asset",
                        image: { bytesBase64Encoded: bytes, mimeType: mime },
                    };
                }
            })
        );

        // GCS output path
        const gcsBucket = process.env.GCS_VIDEO_BUCKET || `${projectId}-veo-output`;
        const outputPath = `veo-output/${user.id}/${Date.now()}.mp4`;
        const storageUri = `gs://${gcsBucket}/${outputPath}`;

        const payload = {
            instances: [{
                prompt: prompt.trim(),
                referenceImages: refImagePayloads,
            }],
            parameters: {
                sampleCount: 1,
                durationSeconds: 8,
                aspectRatio: ["16:9", "9:16"].includes(aspectRatio) ? aspectRatio : "16:9",
                storageUri,
                personGeneration: "allow_all",
                negativePrompt: "distortion, low quality, shaky, blurry, watermark, text",
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
                ],
            },
        };

        const veoUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;
        const veoRes = await fetch(veoUrl, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!veoRes.ok) {
            const errText = await veoRes.text();
            console.error("Magic Video error:", errText);
            return NextResponse.json({ error: `Generation failed: ${veoRes.status}`, details: errText }, { status: veoRes.status });
        }

        const { name: operationName } = await veoRes.json();
        console.log("Reference-to-Video operation started:", operationName);

        // Poll
        const response = await pollOperation(projectId, location, modelId, operationName, token);
        const videos = response?.videos || response?.predictions || [];
        if (!videos.length) {
            throw new Error(`No video returned. Response: ${JSON.stringify(response).slice(0, 500)}`);
        }

        const videoData = videos[0];
        let uploadBody: Buffer;
        if (videoData.bytesBase64Encoded) {
            uploadBody = Buffer.from(videoData.bytesBase64Encoded, "base64");
        } else if (videoData.gcsUri) {
            const gcsUrl = videoData.gcsUri.replace("gs://", "https://storage.googleapis.com/");
            const gcsRes = await fetch(gcsUrl, { headers: { Authorization: `Bearer ${token}` } });
            if (!gcsRes.ok) throw new Error(`GCS fetch failed: ${gcsRes.status}`);
            uploadBody = Buffer.from(await gcsRes.arrayBuffer());
        } else {
            throw new Error("No video bytes or GCS URI in response");
        }

        // Upload to Supabase
        const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
        const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
        const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
        const BUCKET = process.env.NEXT_PUBLIC_GENERATIONS_BUCKET || "generations";
        const filePath = `videos/${user.id}/${Date.now()}.mp4`;

        const { error: uploadError } = await admin.storage
            .from(BUCKET)
            .upload(filePath, uploadBody, { contentType: "video/mp4", upsert: false });
        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        const { data: pubUrl } = admin.storage.from(BUCKET).getPublicUrl(filePath);
        const videoUrl = pubUrl.publicUrl;

        // Save DB
        await admin.from("video_generations").insert({
            user_id: user.id,
            video_url: videoUrl,
            prompt: prompt.trim(),
            status: "completed",
            is_public: true,
        });

        // Deduct credits
        if (!isAdmin) {
            await admin.rpc("decrement_credits", { x: VIDEO_COST, user_id_param: user.id });
        }

        return NextResponse.json({ videoUrl, remainingCredits: credits - VIDEO_COST });
    } catch (e: any) {
        console.error("Magic Video API Error:", e);
        return NextResponse.json({ error: e.message || "Internal error" }, { status: 500 });
    }
}
