"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Bot, Loader2, Zap, BookOpen, Palette, Camera, SkipForward } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

// --- SCRIPTED MESSAGES ---
const SCRIPTS = {
    welcome: [
        "Welcome to the AI Skills Studio! I'm your AI Strategist. ✨",
        "First things first — let's get your account set up.",
        "Let's create your **username**. This is how people will find you. Type it below."
    ],
    username_success: [
        "Great! Next is your **display name**. What do you want people to call you?"
    ],
    username_taken: (name: string) => [
        `**${name}** is already taken. Try another one!`
    ],
    username_short: [
        "Username needs at least **3 characters**. Try again!"
    ],
    display_name_success: [
        "Last thing — let's upload a **profile picture**. It can be anything. 📸"
    ],
    photo_success: [
        "Looking good! 🔥",
        "What would you like to do next?"
    ],
    photo_skip: [
        "No worries, you can always add one later.",
        "What would you like to do next?"
    ],
    complete: (intent: string) => {
        const label = intent === "learn" ? "Learn" : "Create";
        return [
            `**${label}** it is! You're all set. 🎫`,
            "Redirecting you now..."
        ];
    },
    error: [
        "Something went wrong. Try that again!"
    ]
};

type Step = "welcome" | "username" | "display_name" | "photo" | "intent" | "complete";

interface ChatMessage {
    role: "bot" | "user";
    text: string;
    imageUrl?: string;
}

interface OnboardingChatProps {
    onInputFocus?: () => void;
}

export default function OnboardingChat({ onInputFocus }: OnboardingChatProps) {
    const router = useRouter();
    const supabase = createSupabaseBrowserClient();
    const [step, setStep] = useState<Step>("welcome");
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [uploading, setUploading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reliable scroll-to-bottom
    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
            }, 50);
        });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping, scrollToBottom]);

    // Simulate typing delay then add bot messages
    const addBotMessages = useCallback(async (texts: string[], onDone?: () => void) => {
        setIsTyping(true);
        scrollToBottom();
        for (let i = 0; i < texts.length; i++) {
            const delay = Math.min(400 + texts[i].length * 12, 1200);
            await new Promise(r => setTimeout(r, delay));
            setMessages(prev => [...prev, { role: "bot", text: texts[i] }]);
            scrollToBottom();
        }
        setIsTyping(false);
        scrollToBottom();
        onDone?.();
    }, [scrollToBottom]);

    // Initial welcome
    useEffect(() => {
        addBotMessages(SCRIPTS.welcome, () => setStep("username"));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // --- STEP HANDLERS ---

    const handleUsername = async (value: string) => {
        if (value.length < 3) { await addBotMessages(SCRIPTS.username_short); return; }
        setLoading(true);
        try {
            const res = await fetch("/api/onboarding/update-profile", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: value })
            });
            const data = await res.json();
            if (data.error) {
                await addBotMessages(res.status === 409 ? SCRIPTS.username_taken(value) : SCRIPTS.error);
            } else {
                await addBotMessages(SCRIPTS.username_success, () => setStep("display_name"));
            }
        } catch { await addBotMessages(SCRIPTS.error); }
        finally { setLoading(false); }
    };

    const handleDisplayName = async (value: string) => {
        if (!value) return;
        setLoading(true);
        try {
            const res = await fetch("/api/onboarding/update-profile", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full_name: value })
            });
            const data = await res.json();
            if (data.error) { await addBotMessages(SCRIPTS.error); }
            else { await addBotMessages(SCRIPTS.display_name_success, () => setStep("photo")); }
        } catch { await addBotMessages(SCRIPTS.error); }
        finally { setLoading(false); }
    };

    const handlePhotoUpload = async (file: File) => {
        setUploading(true);
        setMessages(prev => [...prev, { role: "user", text: "Uploading photo..." }]);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");
            const ext = file.name.split(".").pop();
            const filePath = `${user.id}/avatar.${ext}`;
            const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
            await fetch("/api/onboarding/update-profile", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatar_url: publicUrl })
            });
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "user", text: "", imageUrl: publicUrl };
                return updated;
            });
            await addBotMessages(SCRIPTS.photo_success, () => setStep("intent"));
        } catch (e: any) {
            console.error("Upload error:", e);
            await addBotMessages(SCRIPTS.error);
        } finally { setUploading(false); }
    };

    const handlePhotoSkip = async () => {
        setMessages(prev => [...prev, { role: "user", text: "Skip for now" }]);
        await addBotMessages(SCRIPTS.photo_skip, () => setStep("intent"));
    };

    const handleIntent = async (intent: "learn" | "create") => {
        setMessages(prev => [...prev, {
            role: "user",
            text: intent === "learn" ? "Learn" : "Create"
        }]);
        setLoading(true);
        try {
            const res = await fetch("/api/onboarding/set-intent", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ intent })
            });
            const data = await res.json();
            if (data.error) { await addBotMessages(SCRIPTS.error); }
            else {
                setStep("complete");
                await addBotMessages(SCRIPTS.complete(intent));
                setTimeout(() => {
                    if (intent === "learn") router.push("/learn");
                    else if (intent === "create") router.push("/community");
                    else router.push("/dashboard");
                }, 2000);
            }
        } catch { await addBotMessages(SCRIPTS.error); }
        finally { setLoading(false); }
    };

    const handleSubmit = async () => {
        if (!input.trim() || loading || isTyping) return;
        const value = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", text: value }]);
        if (step === "username") await handleUsername(value);
        else if (step === "display_name") await handleDisplayName(value);
    };

    const showInput = step === "username" || step === "display_name";
    const showPhotoUpload = step === "photo";
    const showIntentButtons = step === "intent";

    return (
        <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                <div className="max-w-xl mx-auto space-y-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                            style={{ animation: "fadeSlideIn 0.3s ease-out" }}>
                            {msg.role === "bot" ? (
                                <div className="w-8 h-8 rounded-full border border-[#B7FF00]/20 bg-[#B7FF00]/10 text-[#B7FF00] flex items-center justify-center shrink-0">
                                    <img src="/logo-symbol.png" alt="AI" className="w-5 h-5 object-contain" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full border border-white/10 bg-zinc-800 text-white/60 flex items-center justify-center shrink-0 overflow-hidden">
                                    {msg.imageUrl ? (
                                        <img src={msg.imageUrl} alt="avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[10px] font-medium">You</span>
                                    )}
                                </div>
                            )}
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.role === "bot"
                                ? "bg-white/5 border border-white/10 text-white/90 rounded-tl-none"
                                : "bg-[#B7FF00] text-black font-medium rounded-tr-none"
                                }`}>
                                {msg.imageUrl ? (
                                    <img src={msg.imageUrl} alt="Uploaded" className="w-20 h-20 rounded-lg object-cover" />
                                ) : (
                                    <span dangerouslySetInnerHTML={{
                                        __html: msg.text
                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                    }} />
                                )}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full border border-[#B7FF00]/20 bg-[#B7FF00]/10 text-[#B7FF00] flex items-center justify-center shrink-0 animate-pulse">
                                <img src="/logo-symbol.png" alt="AI" className="w-5 h-5 object-contain" />
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 border-t border-white/10 shrink-0">
                <div className="max-w-xl mx-auto">
                    {/* Photo Upload */}
                    {showPhotoUpload && !isTyping && (
                        <div className="flex gap-2 mb-2">
                            <input type="file" ref={fileInputRef} accept="image/*" className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }}
                            />
                            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#B7FF00]/20 bg-[#B7FF00]/5 hover:bg-[#B7FF00]/10 transition-all text-[#B7FF00] text-sm font-medium">
                                {uploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><Camera size={16} /> Upload Photo</>}
                            </button>
                            <button onClick={handlePhotoSkip} disabled={uploading}
                                className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-white/40 text-sm font-medium">
                                <SkipForward size={14} /> Skip
                            </button>
                        </div>
                    )}

                    {/* Intent Buttons */}
                    {showIntentButtons && !loading && !isTyping && (
                        <div className="flex gap-2 mb-2">
                            <button onClick={() => handleIntent("learn")}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 hover:border-[#B7FF00]/30 hover:bg-white/5 transition-all text-white text-sm font-medium group">
                                <BookOpen size={16} className="text-blue-400" /> Learn
                            </button>
                            <button onClick={() => handleIntent("create")}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 hover:border-[#B7FF00]/30 hover:bg-white/5 transition-all text-white text-sm font-medium group">
                                <Palette size={16} className="text-purple-400" /> Create
                            </button>
                        </div>
                    )}

                    {/* Text Input */}
                    {showInput && (
                        <div className="relative">
                            <input type="text" value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                                placeholder={step === "username" ? "Enter a username..." : "Enter your display name..."}
                                disabled={loading || isTyping}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#B7FF00]/50 focus:ring-1 focus:ring-[#B7FF00]/20 transition-all placeholder:text-white/20 disabled:opacity-50"
                                onFocus={onInputFocus}
                            />
                            <button onClick={handleSubmit} disabled={!input.trim() || loading || isTyping}
                                className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-[#B7FF00] text-black rounded-lg hover:bg-[#c8ff33] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center">
                                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    )}

                    {/* Complete */}
                    {step === "complete" && (
                        <div className="text-center py-2">
                            <div className="flex items-center justify-center gap-2 text-[#B7FF00] text-xs font-mono">
                                <Loader2 size={12} className="animate-spin" /> Redirecting...
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
