import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getBusinessContext } from "@/lib/businessContext"; // Agentic

export const runtime = "nodejs";

// Using gemini-flash-latest to avoid rate limits on preview models
// This typically maps to stable 1.5 Flash which has higher quotas
const MODEL_ID = "gemini-flash-latest";

export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { messages, folderId, context: userContext, chatId } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
        }

        // --- PERSISTENCE LAYER START ---

        let activeChatId = chatId;

        // 0. Handle New Chat Creation if no ID provided
        if (!activeChatId) {
            const firstMsgContent = messages[messages.length - 1].content;
            const title = firstMsgContent.substring(0, 50) + (firstMsgContent.length > 50 ? "..." : "");

            const { data: newChat, error: chatError } = await supabase
                .from("notebook_chats")
                .insert({
                    user_id: user.id,
                    folder_id: folderId || null,
                    title: title
                })
                .select()
                .single();

            if (chatError) throw chatError;
            activeChatId = newChat.id;
        }

        // 1. Determine Mode & Context
        let systemInstructionText = `
ROLE:
You are the "Lead AI Strategist & Workspace Architect" for AI Skills Studio.
You help users with their business strategy, prompt engineering, and content creation.

TARGET AUDIENCE:
Your users are small, locally-owned business owners and creators. They are non-technical ("non-techie"). 
You MUST ALWAYS speak to them at a 6th-grade reading level. Use extremely simple words, short sentences, and absolutely NO technical jargon.

CRITICAL RULES:
1. NEVER mention or suggest using any other software, apps, or platforms outside of AI Skills Studio (e.g., do not suggest Canva, Midjourney, ChatGPT, etc.). Your goal is to teach them how to use AI Skills Studio.
2. Teach the user how to be a better creator with AI, keeping instructions simple and actionable.
3. When they want to make a video, ALWAYS advise them that it is a best practice to start by generating an image for the start frame first, so they have a better idea of the aesthetic and composition they are going to get.

When the user asks for help writing a prompt, you MUST:
1. Walk them through the process step-by-step.
2. Ask simple questions one at a time to gather what they need.
3. Help them craft a prompt specifically tailored to their small business (like a flyer) or creator content (like a video).

Current Context: ${userContext || "None"}
`;

        // STRATEGIST MODE (if folderId is present)
        if (folderId) {
            const { data: notes } = await supabase
                .from("notebook_notes")
                .select("title, content")
                .eq("folder_id", folderId)
                .eq("user_id", user.id)
                .limit(5);

            let folderContext = "";
            if (notes && notes.length > 0) {
                folderContext = `\n\nCURRENT FOLDER CONTEXT:\nThe user is currently working in a folder containing these notes. Use them to maintain consistency:\n`;
                notes.forEach(n => {
                    folderContext += `--- NOTE: ${n.title} ---\n${n.content}\n`;
                });
                folderContext += `----------------------------------\n`;
            }

            systemInstructionText += folderContext;
        }

        // Agentic Memory Injection
        const businessContext = await getBusinessContext(user.id, supabase);
        if (businessContext) {
            systemInstructionText += `\n\n[BUSINESS BLUEPRINT CONTEXT - AGENTIC MEMORY]\n(Use this user's specific business context for all strategic advice):\n${businessContext}\n`;
        }

        // 2. Initialize Google AI (API Key)
        const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
        if (!apiKey) {
            throw new Error("Missing GOOGLE_AI_STUDIO_KEY");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: MODEL_ID,
            systemInstruction: systemInstructionText
        });

        // 3. Convert Messages to Gemini Format
        const history = messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        const lastMsg = history.pop(); // The user's new message

        if (!lastMsg) {
            return NextResponse.json({ error: "No messages provided" }, { status: 400 });
        }

        // SAVE USER MESSAGE TO DB
        await supabase.from("notebook_chat_messages").insert({
            chat_id: activeChatId,
            role: "user",
            content: lastMsg.parts[0].text
        });

        const chat = model.startChat({
            history: history
        });

        const result = await chat.sendMessageStream(lastMsg.parts[0].text);

        // 4. Stream Response AND Accumulate for Persistence
        let fullResponseText = "";

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        if (chunkText) {
                            fullResponseText += chunkText;
                            controller.enqueue(new TextEncoder().encode(chunkText));
                        }
                    }

                    // SAVE ASSISTANT RESPONSE TO DB (Once stream is done)
                    if (fullResponseText) {
                        await supabase.from("notebook_chat_messages").insert({
                            chat_id: activeChatId,
                            role: "assistant",
                            content: fullResponseText
                        });

                        // Update Chat Timestamp
                        await supabase.from("notebook_chats")
                            .update({ updated_at: new Date().toISOString() })
                            .eq("id", activeChatId);
                    }

                } catch (streamError) {
                    console.error("Stream Error:", streamError);
                    controller.error(streamError);
                } finally {
                    controller.close();
                }
            }
        });

        // Return stream with custom header for the new Chat ID (so client knows it created one)
        return new NextResponse(stream, {
            headers: {
                "Content-Type": "text/plain",
                "X-Chat-Id": activeChatId
            }
        });

    } catch (e: any) {
        console.error("Chat Error:", e);
        return NextResponse.json({ error: e.message || "Chat failed" }, { status: 500 });
    }
}
