"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, Send, X } from "lucide-react";

export type QueueItem = any; // Deprecated, keeping for type drift if any external files ref it, but unused locally.

type Props = {
    isOpen: boolean;
    onClose: () => void;
    sourceImageUrl: string;
    onGenerate: (prompt: string) => void;
    isGenerating?: boolean;
};

const SUGGESTIONS = [
    "Make it cinematic",
    "Add dramatic lighting",
    "Change background to a modern office",
    "Fix blurry details",
    "Make it pop",
    "Cyberpunk style"
];

export default function EditModeModal({ isOpen, onClose, sourceImageUrl, onGenerate, isGenerating }: Props) {
    const [input, setInput] = useState("");

    if (!isOpen) return null;

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const p = input.trim();
        if (!p || isGenerating) return;
        onGenerate(p);
        setInput("");
    };

    const handleSuggestion = (s: string) => {
        if (isGenerating) return;
        onGenerate(s);
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4" role="dialog">
            <div className="flex h-[80vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl flex-col md:flex-row">

                {/* Left: Preview (Locked) */}
                <div className="relative flex-1 bg-neutral-900/50 min-h-[300px] flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10 p-6">
                    <div className="absolute top-4 left-4 z-10 rounded-lg bg-black/60 px-3 py-1 text-xs font-mono text-white/50 border border-white/5 backdrop-blur-md">
                        SOURCE IMAGE
                    </div>
                    <div className="relative h-full w-full max-w-md md:max-w-full">
                        <Image
                            src={sourceImageUrl}
                            alt="Source to edit"
                            fill
                            className="object-contain"
                            unoptimized
                        />
                    </div>
                </div>

                {/* Right: Chat/Controls */}
                <div className="flex w-full md:w-[400px] flex-col bg-neutral-900 border-l border-white/5">

                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 p-4 bg-black/20">
                        <div className="flex items-center gap-2">
                            <Sparkles size={16} className="text-[#B7FF00]" />
                            <span className="text-sm font-bold text-white">Refine & Edit</span>
                        </div>
                        <button onClick={onClose} disabled={isGenerating} className="text-white/50 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Chat Area (Empty state or history if we implemented history, but for now single turn) */}
                    <div className="flex-1 flex flex-col justify-end p-4 space-y-4">

                        <div className="flex-1 flex items-center justify-center text-center opacity-30 px-6">
                            <div>
                                <p className="text-sm">Describe what you want to change.</p>
                                <p className="text-xs mt-1">E.g. Fix a typo, change the background, adjust the vibe...</p>
                            </div>
                        </div>

                        {/* Suggestions */}
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTIONS.map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleSuggestion(s)}
                                    disabled={isGenerating}
                                    className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all disabled:opacity-50 text-left"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="relative">
                            <input
                                className="w-full rounded-xl bg-black border border-white/10 p-4 pr-12 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00]/50 transition-all"
                                placeholder={isGenerating ? "Processing..." : "Type your edit..."}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={isGenerating}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isGenerating}
                                className="absolute right-2 top-2 p-2 rounded-lg text-[#B7FF00] hover:bg-[#B7FF00]/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                            >
                                {isGenerating ? <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Send size={18} />}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
