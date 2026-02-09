import { GoogleAuth } from "google-auth-library";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { messages, context } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Invalid messages format" }, { status: 400 });
        }

        // Get credentials - match the image generation pattern
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
        const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

        if (!projectId || !credsJson) {
            throw new Error("Missing Google Cloud credentials");
        }

        let credentials;
        try {
            credentials = JSON.parse(credsJson);
        } catch {
            throw new Error("GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON");
        }

        // Vertex Auth - same as image generation
        const auth = new GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        });

        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (!token?.token) {
            return NextResponse.json({ error: "Failed to get Vertex access token" }, { status: 401 });
        }

        const model = "gemini-1.5-flash";
        const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

        // Build system context
        const systemContext = `You are the AI assistant for AI Skills Bootcamp.
${context ? `Current context: ${context}` : ""}`;

        // Convert messages to Vertex format
        const contents = [
            {
                role: "user",
                parts: [{ text: systemContext }],
            },
            {
                role: "model",
                parts: [{ text: "I understand." }],
            },
        ];

        // Add chat history
        for (const msg of messages) {
            contents.push({
                role: msg.role === "user" ? "user" : "model",
                parts: [{ text: msg.content }],
            });
        }

        const payload = {
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        };

        // Call Vertex API
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

        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        return NextResponse.json({
            message: text || "I'm not sure how to respond to that.",
            role: "assistant",
        });

    } catch (error: any) {
        console.error("Chat API error:", error);
        return NextResponse.json(
            { error: "Failed to get AI response", details: error.message || String(error) },
            { status: 500 }
        );
    }
}
