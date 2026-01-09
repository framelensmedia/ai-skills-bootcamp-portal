"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Minimize2, Send, Sparkles, User, RefreshCw } from "lucide-react";

type Message = {
    role: "user" | "assistant";
    content: string;
};

export default function AIAssistant() {
    const supabase = createSupabaseBrowserClient();

    // UI States
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false); // Controls 80% -> 100% expansion
    const [isIdle, setIsIdle] = useState(false);

    // Chat States
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initial Load
    useEffect(() => {
        async function checkUser() {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name, username")
                    .eq("user_id", authUser.id)
                    .single();

                const displayName = profile?.full_name || profile?.username || "there";
                setUser({ ...authUser, displayName });
            }
        }
        checkUser();
    }, [supabase]);

    // Auto-hide tab logic
    useEffect(() => {
        const timer = setTimeout(() => setIsIdle(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    const handleMouseEnter = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        setIsIdle(false);
    };

    const handleMouseLeave = () => {
        idleTimerRef.current = setTimeout(() => setIsIdle(true), 2000);
    };

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    // Send Message
    async function handleSendMessage(content?: string) {
        if (!isExpanded) setIsExpanded(true);
        const text = content || input.trim();
        if (!text) return;

        const userMsg: Message = { role: "user", content: text };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, userMsg],
                    context: `User: ${user?.displayName || "Unknown"}`
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
            } else {
                setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I had a connection glitch. Please try again." }]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages((prev) => [...prev, { role: "assistant", content: "I'm having trouble connecting right now." }]);
        } finally {
            setLoading(false);
        }
    }

    const clearChat = () => {
        setMessages([]);
        setInput("");
    };

    if (!user) return null;

    const hasMessages = messages.length > 0;

    return (
        <>
            {/* --- IMMERSIVE CHAT OVERLAY --- */}
            <div
                onClick={() => setIsExpanded(true)}
                className={`fixed z-[100] flex flex-col transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
                    } ${isExpanded
                        ? "inset-0 rounded-none bg-black/95 backdrop-blur-xl"
                        : "inset-[5%] md:inset-[10%] rounded-[2.5rem] bg-black/80 backdrop-blur-md shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10"
                    }`}
            >
                {/* Close & Header Controls */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 pointer-events-none">
                    {/* Left: Branding (Only visible when Expanded) */}
                    <div className={`flex items-center gap-3 pointer-events-auto transition-opacity duration-500 ${isExpanded ? "opacity-100" : "opacity-0"}`}>
                        <div className="relative h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                            <Image
                                src="/logo-symbol.png"
                                alt="AI Skills Bootcamp"
                                fill
                                className="object-contain"
                            />
                        </div>
                        <span className="min-w-0 whitespace-nowrap truncate text-base font-semibold tracking-tight sm:text-lg">
                            <span className="text-[#B7FF00]">AI Skills</span>{" "}
                            <span className="text-white">Bootcamp</span>
                        </span>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex gap-4 pointer-events-auto">
                        {hasMessages && (
                            <button
                                onClick={clearChat}
                                className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:bg-white/10 hover:text-white transition"
                                title="Clear History"
                            >
                                <RefreshCw size={18} />
                            </button>
                        )}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition"
                            title="Minimize"
                        >
                            <Minimize2 size={24} />
                        </button>
                    </div>
                </div>

                {/* --- CONTENT AREA: MORPHS BASED ON STATE --- */}
                <div className={`flex-1 flex flex-col relative overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]`}>

                    {/* 1. HERO STATE (Centered) - Fades out when messages exist */}
                    {/* Added pb-48 to push content UP above the input field */}
                    <div className={`absolute inset-0 flex flex-col items-center justify-center p-4 pb-48 transition-all duration-500 ${hasMessages ? "opacity-0 invisible scale-95" : "opacity-100 visible scale-100"}`}>
                        <div className="flex flex-col items-center gap-6 text-center max-w-2xl w-full z-10">
                            {/* Logo instead of Sparkles */}
                            {/* Replaced Logo back with Sparkles */}
                            <div className="flex h-16 w-16 md:h-24 md:w-24 items-center justify-center rounded-3xl bg-[#B7FF00] text-black shadow-[0_0_50px_rgba(183,255,0,0.3)] mb-2 animate-pulse-slow">
                                <Sparkles className="h-8 w-8 md:h-12 md:w-12 fill-current" />
                            </div>

                            <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">Ask AI</h2>
                            <p className="text-xl text-white/50 leading-relaxed mb-8">
                                Hi {user.displayName}. <br />What can I create for you today?
                            </p>

                            {/* Suggestions */}
                            <div className="flex flex-wrap justify-center gap-3 w-full max-w-xl">
                                {[
                                    "Write a catchy headline",
                                    "Suggest blog topics",
                                    "Explain the remix tool",
                                    "Create a logo Prompt"
                                ].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => handleSendMessage(s)}
                                        className="px-4 py-2 rounded-full border border-white/5 bg-white/5 text-sm text-white/60 hover:bg-white/10 hover:border-white/20 hover:text-white transition hover:-translate-y-0.5"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* 2. CHAT HISTORY (Fills screen) - Fades in */}
                    <div className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-4 md:p-20 pt-24 transition-all duration-500 ${hasMessages ? "opacity-100 visible" : "opacity-0 invisible"}`}>
                        <div className="mx-auto max-w-3xl space-y-8">
                            {messages.map((msg, i) => (
                                <div key={i} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex max-w-[90%] md:max-w-[80%] gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

                                        {/* Avatar */}
                                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm ${msg.role === 'user'
                                            ? 'border-white/10 bg-white/5 text-white'
                                            : 'border-[#B7FF00]/20 bg-[#B7FF00]/10 text-[#B7FF00]'
                                            }`}>
                                            {msg.role === 'user' ? <User size={18} /> : <Sparkles size={18} className="fill-current" />}
                                        </div>

                                        {/* Bubble */}
                                        <div className={`px-6 py-4 text-base leading-relaxed shadow-md backdrop-blur-sm ${msg.role === 'user'
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
                                    <div className="flex gap-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#B7FF00]/20 bg-[#B7FF00]/10 text-[#B7FF00]">
                                            <Sparkles size={18} className="fill-current" />
                                        </div>
                                        <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-white/5 bg-white/10 px-6 py-5">
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-[#B7FF00]"></span>
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-[#B7FF00] delay-100"></span>
                                            <span className="h-2 w-2 animate-bounce rounded-full bg-[#B7FF00] delay-200"></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* 3. INPUT AREA (Morphs position) */}
                    <div className={`w-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] shrink-0 z-30 ${hasMessages
                        ? "bg-black/80 border-t border-white/10 p-6 backdrop-blur-xl"
                        : "absolute bottom-6 md:bottom-1/4 left-0 right-0 flex justify-center px-4"
                        }`}>
                        <div className={`relative transition-all duration-700 w-full ${hasMessages ? "max-w-3xl mx-auto" : "max-w-2xl mx-auto"}`}>
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                placeholder={hasMessages ? "Ask follow-up..." : "What would you like to create today?"}
                                autoFocus={isOpen}
                                className={`w-full rounded-2xl bg-white/5 border pl-6 pr-16 transition-all shadow-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00]/50 focus:bg-black/50 ${hasMessages
                                    ? "h-14 border-white/10 text-base"
                                    : "h-20 border-white/10 text-base py-6 hover:border-white/20"
                                    }`}
                            />
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSendMessage(); }}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-xl bg-[#B7FF00] text-black hover:bg-[#B7FF00] hover:scale-105 transition-all shadow-[0_0_15px_rgba(183,255,0,0.4)] ${hasMessages ? "h-10 w-10 right-2" : "h-12 w-12 right-4"
                                    }`}
                            >
                                <Send size={hasMessages ? 18 : 24} />
                            </button>
                        </div>
                        {hasMessages && (
                            <p className="mt-3 text-center text-[10px] text-white/30 max-w-lg mx-auto">
                                AI can make mistakes. Please check important information.
                            </p>
                        )}
                    </div>

                </div>
            </div>

            {/* --- MINIMIZED BUTTON (Bottom Tab) --- */}
            <div
                className={`fixed bottom-0 right-8 z-[90] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${!isOpen ? "translate-y-0" : "translate-y-20 opacity-0 pointer-events-none"
                    }`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <button
                    onClick={() => { setIsOpen(true); setIsExpanded(false); }}
                    className={`group flex items-center gap-2 rounded-t-xl bg-[#B7FF00]/90 backdrop-blur-sm px-6 py-2.5 shadow-[0_0_20px_rgba(183,255,0,0.2)] transition-all duration-500 will-change-transform ${isIdle
                        ? "translate-y-[65%] opacity-40 hover:translate-y-0 hover:opacity-100"
                        : "translate-y-0 opacity-100 hover:pb-4 hover:-translate-y-1"
                        }`}
                >
                    <Sparkles size={18} className="text-black fill-current" />
                    <span className="text-sm font-bold text-black tracking-wide">Ask AI</span>
                    <span className={`ml-1 h-2 w-2 rounded-full bg-black animate-pulse opacity-50 transition-opacity ${isIdle ? 'opacity-0' : 'opacity-50'}`}></span>
                </button>
            </div>
        </>
    );
}
