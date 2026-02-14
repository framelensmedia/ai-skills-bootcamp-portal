
"use client";

import { useState, useEffect, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Send, Loader2, MessageSquare, Book, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface StudioChatInterfaceProps {
    chatId: string | null;
    initialMessages?: Message[];
    onNewChatId?: (id: string) => void;
    onSaveToNote?: (content: string) => void;
    onInputFocus?: () => void;
    placeholderText?: string;
    className?: string;
}

export default function StudioChatInterface({
    chatId,
    initialMessages = [],
    onNewChatId,
    onSaveToNote,
    onInputFocus,
    placeholderText = "Ask the strategist...",
    className = ""
}: StudioChatInterfaceProps) {

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Reset when chat changes
    useEffect(() => {
        if (chatId) {
            loadChatHistory(chatId);
        } else {
            setMessages([]);
        }
    }, [chatId]);

    // Construct loadChatHistory to be self-sufficient
    const loadChatHistory = async (id: string) => {
        setLoading(true);
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
            .from("notebook_chat_messages")
            .select("*")
            .eq("chat_id", id)
            .order("created_at", { ascending: true });

        if (data) {
            setMessages(data.map((m: any) => ({ role: m.role, content: m.content })));
        }
        setLoading(false);
    };

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userMsg = input.trim();
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMsg }]);
        setLoading(true);

        try {
            const response = await fetch("/api/ai/strategist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [...messages, { role: "user", content: userMsg }],
                    chatId: chatId
                })
            });

            if (!response.ok) throw new Error("Failed to send");

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let aiText = "";

            if (reader) {
                // Handle new chat creation if ID returned
                const newChatId = response.headers.get("X-Chat-Id");
                if (newChatId && newChatId !== chatId && onNewChatId) {
                    onNewChatId(newChatId);
                }

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    aiText += chunk;

                    setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last?.role === "assistant") {
                            return [...prev.slice(0, -1), { role: "assistant", content: aiText }];
                        } else {
                            return [...prev, { role: "assistant", content: aiText }];
                        }
                    });
                }
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, { role: "assistant", content: "Error: Could not connect to Strategist." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col h-full relative ${className}`}>
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth scrollbar-thin scrollbar-thumb-gray-800">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-50">
                            <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mb-4">
                                <MessageSquare size={32} className="text-[#B7FF00]" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">AI Strategist</h2>
                            <p className="text-sm max-w-md text-gray-400 mb-8">I can help you audit your business, write content, or plan your next launch. What's on your mind?</p>

                            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                                {[
                                    "Plan a product launch",
                                    "Audit my current strategy",
                                    "Write a welcome email",
                                    "Draft a social media calendar"
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => {
                                            setInput(suggestion);
                                            // Optional: automatically send
                                            // sendMessage(); 
                                        }}
                                        className="px-4 py-2 bg-white/5 hover:bg-[#B7FF00]/10 border border-white/10 hover:border-[#B7FF00]/50 rounded-full text-sm text-gray-300 hover:text-[#B7FF00] transition-all"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-4 ${msg.role === "assistant" ? "" : "flex-row-reverse"}`}>
                            {/* Avatar */}
                            {msg.role === "assistant" ? (
                                <div className="w-8 h-8 rounded-full border border-[#B7FF00]/20 bg-[#B7FF00]/10 text-[#B7FF00] flex items-center justify-center shrink-0">
                                    <img src="/logo-symbol.png" alt="AI" className="w-5 h-5 object-contain" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-full border border-white/10 bg-white/5 text-white flex items-center justify-center shrink-0">
                                    <User size={18} />
                                </div>
                            )}

                            {/* Bubble */}
                            <div className={`max-w-[85%] rounded-2xl px-6 py-4 text-base leading-relaxed shadow-md backdrop-blur-sm group relative ${msg.role === "assistant"
                                ? "bg-white/10 text-white/90 border border-white/5 rounded-tl-none"
                                : "bg-[#B7FF00] text-black rounded-tr-none"
                                }`}>
                                <div className={`prose prose-sm max-w-none break-words ${msg.role === "assistant" ? "prose-invert" : ""}`}>
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>

                                {/* Action Buttons for AI Messages */}
                                {msg.role === "assistant" && onSaveToNote && (
                                    <div className="mt-4 pt-3 border-t border-white/10 flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => onSaveToNote(msg.content)}
                                            className="text-xs flex items-center gap-2 text-[#B7FF00] hover:text-[#c4ff4d] transition-colors font-medium"
                                        >
                                            <Book size={14} /> Save to Notebook
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Loading Indicator */}
                    {loading && messages[messages.length - 1]?.role === "user" && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full border border-[#B7FF00]/20 bg-[#B7FF00]/10 text-[#B7FF00] flex items-center justify-center shrink-0"><img src="/logo-symbol.png" alt="AI" className="w-5 h-5 object-contain" /></div>
                            <div className="bg-white/10 border border-white/5 rounded-2xl rounded-tl-none p-4 flex items-center gap-2 text-white/50 text-sm">
                                <Loader2 className="animate-spin" size={16} /> Thinking...
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-800 bg-black/50 backdrop-blur shrink-0 relative z-10">
                <div className="max-w-3xl mx-auto relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={onInputFocus}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        placeholder={placeholderText}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-white focus:outline-none focus:border-[#B7FF00]/50 focus:bg-black/50 resize-none h-[52px] max-h-[200px] placeholder:text-white/30"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || loading}
                        className="absolute right-2 top-2 p-2 bg-[#B7FF00] text-black rounded-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <Send size={16} />
                    </button>
                </div>
                <div className="text-center mt-2 text-[10px] text-white/30">
                    AI can make mistakes. Verify important info.
                </div>
            </div>
        </div>
    );
}
