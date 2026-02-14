import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

// Initialize Gemini (using same key as strategist route)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_STUDIO_KEY || "");

const MODEL_NAME = "gemini-flash-latest";

const systemInstruction = `
You are the "Office Manager" for the AI Skills Studio. Your job is to onboard new users with a witty, slightly bureaucratic but helpful persona (think "The Office" meets a helpful startup bot).

You must guide the user through this STRICT sequence. Do not deviate.
1. **Welcome**: Greet them, welcome to the studio.
2. **Username**: Ask for a username. Call 'update_profile' with 'username'. If it fails (e.g. taken), ask for another one.
3. **Display Name**: Ask for a display name (what people will see). Call 'update_profile' with 'full_name'.
4. **Photo**: Ask if they want to upload a profile photo or skip.
   - If they provide a URL or say "skip", acknowledge it. You cannot actually upload files yourself, just ask them to "pretend" or skip for now if they can't.
   - Actually, for this MVP, just ask them to describe themselves or skip, as we can't handle file uploads in chat yet easily. Just say "We'll set up a photo later." and move on.
5. **Intent**: Ask if they are here to 'Learn' (take courses) or 'Create' (make prompts/remixes).
   - Call 'set_intent' with their choice.
   - If they say "both", use 'both'.
6. **Complete**: Once intent is set, the system will redirect them. You should give a final "Badge printed! You're all set." message.

**Guardrails**:
- Do not chat about random topics. Steering back to onboarding.
- Be concise. One question at a time.
- If a tool call fails, explain why and ask again.
`;

const tools = [
    {
        functionDeclarations: [
            {
                name: "update_profile",
                description: "Update user profile fields",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        username: { type: SchemaType.STRING },
                        full_name: { type: SchemaType.STRING },
                        avatar_url: { type: SchemaType.STRING },
                    },
                } as any, // Cast to avoid strict schema type errors
            },
            {
                name: "set_intent",
                description: "Set user intent and complete onboarding",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        intent: { type: SchemaType.STRING, description: "learn, create, or both" },
                    },
                    required: ["intent"],
                } as any,
            },
        ],
    },
];

export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { history, message } = body;
        // history: array of { role: 'user' | 'model', parts: [{ text: ... }] }

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction,
            tools: tools,
        });

        const chat = model.startChat({
            history: history || [],
        });

        const result = await chat.sendMessage(message);
        const response = await result.response;
        const functionCalls = response.functionCalls();

        let finalResponseText = "";
        let toolResults = [];

        if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
                const fnName = call.name;
                const args = call.args as any;

                let fnResult;
                if (fnName === "update_profile") {
                    const updates: any = {};
                    if (args.username) updates.username = args.username;
                    if (args.full_name) updates.full_name = args.full_name;
                    if (args.avatar_url) updates.profile_image = args.avatar_url;

                    // Validation for username
                    if (updates.username && updates.username.length < 3) {
                        fnResult = { error: "Username must be 3+ chars" };
                    } else {
                        const { error } = await supabase.from("profiles").update(updates).eq("user_id", user.id);
                        if (error && error.code === '23505') {
                            fnResult = { error: "Username taken" };
                        } else if (error) {
                            fnResult = { error: error.message };
                        } else {
                            fnResult = { success: true };
                        }
                    }
                } else if (fnName === "set_intent") {
                    const { error } = await supabase.from("profiles").update({
                        intent: args.intent,
                        onboarding_completed: true
                    }).eq("user_id", user.id);

                    if (error) fnResult = { error: error.message };
                    else fnResult = { success: true, redirect: true };
                }

                toolResults.push({
                    functionResponse: {
                        name: fnName,
                        response: fnResult
                    }
                });
            }

            // Send tool results back to model to get final text
            const result2 = await chat.sendMessage(toolResults as any);
            finalResponseText = result2.response.text();

            // Check if we need to signal redirect from the tool results
            const shouldRedirect = toolResults.some((t: any) => t.functionResponse.response?.redirect);

            return NextResponse.json({
                role: "model",
                parts: [{ text: finalResponseText }],
                redirect: shouldRedirect
            });

        } else {
            finalResponseText = response.text();
            return NextResponse.json({
                role: "model",
                parts: [{ text: finalResponseText }]
            });
        }

    } catch (err: any) {
        console.error("Chat API Error:", err);
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}
