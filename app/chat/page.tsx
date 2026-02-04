"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Send, Sparkles, User, ArrowLeft, Bot, Mic } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Types
type Message = {
    role: "user" | "assistant";
    content: string;
};

function ChatContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialQuery = searchParams.get("q");

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [user, setUser] = useState<any>(null);
    const supabase = createSupabaseBrowserClient();

    // Load User
    useEffect(() => {
        supabase.auth.getUser().then(({ data }: { data: { user: any } }) => {
            if (data.user) {
                setUser(data.user);
                fetchProfile(data.user.id);
            } else {
                router.push("/login?next=/chat");
            }
        });
    }, []);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase.from("profiles").select("full_name, username").eq("user_id", userId).single();
        if (data) {
            setUser((u: any) => ({ ...u, displayName: data.full_name || data.username }));
        }
    };

    // Initial Message / Query handling
    useEffect(() => {
        if (user && messages.length === 0) {
            // Add Welcome Message
            const welcomeMsg: Message = {
                role: "assistant",
                content: `Hello ${user.displayName || "there"}! I'm your AI Assistant. How can I help you with your marketing or content today?`
            };

            if (initialQuery) {
                setMessages([welcomeMsg, { role: "user", content: initialQuery }]);
                handleSendMessage(initialQuery, [welcomeMsg]); // Trigger AI response for the query
            } else {
                setMessages([welcomeMsg]);
            }
        }
    }, [user]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const handleSendMessage = async (textOverride?: string, historyOverride?: Message[]) => {
        const textToCheck = textOverride || input;
        if (!textToCheck.trim()) return;

        const history = historyOverride || messages;

        // If not override, add user message to state
        if (!textOverride) {
            setMessages((prev) => [...prev, { role: "user", content: textToCheck }]);
        }

        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...history, { role: "user", content: textToCheck }],
                    context: `User: ${user?.displayName || "Unknown"}`
                }),
            });

            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { data = { error: "Parse Error", message: text }; }

            if (res.ok) {
                setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
            } else {
                setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return <div className="flex h-screen items-center justify-center bg-black text-[#B7FF00]"><Sparkles className="animate-pulse" /></div>;

    return (
        <div className="flex h-screen w-full flex-col bg-black text-white selection:bg-[#B7FF00] selection:text-black">
            {/* Header */}
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-black/60 px-4 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="flex items-center gap-2 text-white/50 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B7FF00] text-black shadow-[0_0_15px_rgba(183,255,0,0.2)]">
                            <Sparkles size={16} className="fill-current" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-tight text-white">Ask AI</h1>
                            <p className="text-[10px] uppercase tracking-wider text-[#B7FF00]">Intelligence Engine</p>
                        </div>
                    </div>
                </div>

                {/* Right Actions? */}
            </header>

            {/* Chat Area */}
            <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-4 md:p-8">
                <div className="mx-auto max-w-3xl space-y-6">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex max-w-[90%] md:max-w-[80%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                                {/* Avatar */}
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${msg.role === 'user'
                                    ? 'border-white/10 bg-white/5 text-white'
                                    : 'border-[#B7FF00]/20 bg-[#B7FF00]/10 text-[#B7FF00]'
                                    }`}>
                                    {msg.role === 'user' ? <User size={14} /> : <Sparkles size={14} className="fill-current" />}
                                </div>

                                {/* Bubble */}
                                <div className={`relative px-5 py-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-[#B7FF00] text-black rounded-2xl rounded-tr-none'
                                    : 'bg-white/10 text-white/90 border border-white/5 rounded-2xl rounded-tl-none'
                                    }`}>
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex w-full justify-start">
                            <div className="flex max-w-[80%] gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#B7FF00]/20 bg-[#B7FF00]/10 text-[#B7FF00]">
                                    <Sparkles size={14} className="fill-current" />
                                </div>
                                <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-white/5 bg-white/10 px-5 py-4">
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#B7FF00]"></span>
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#B7FF00] delay-100"></span>
                                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#B7FF00] delay-200"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input Footer */}
            <footer className="shrink-0 border-t border-white/10 bg-black/80 p-4 backdrop-blur-xl md:p-6">
                <div className="mx-auto max-w-3xl">
                    <div className="relative flex gap-2">
                        <div className="relative flex-1">
                            <input
                                autoFocus
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                placeholder="Ask anything..."
                                className="w-full rounded-xl border border-white/10 bg-neutral-900/50 px-5 py-4 pl-5 pr-12 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00]/50 focus:bg-neutral-900 focus:outline-none focus:ring-1 focus:ring-[#B7FF00]/50 transition shadow-inner"
                            />
                            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition">
                                <Mic size={18} />
                            </button>
                        </div>

                        <button
                            onClick={() => handleSendMessage()}
                            disabled={!input.trim() || loading}
                            className="flex items-center justify-center rounded-xl bg-[#B7FF00] px-5 py-3 text-black transition hover:bg-[#B7FF00]/90 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                        >
                            <Send size={20} />
                        </button>
                    </div>
                    <p className="mt-3 text-center text-[10px] text-white/30">
                        AI can make mistakes. Please check important information.
                    </p>
                </div>
            </footer>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-black text-white">Loading...</div>}>
            <ChatContent />
        </Suspense>
    );
}
