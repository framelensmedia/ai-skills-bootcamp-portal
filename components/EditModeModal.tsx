"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

export type EditIntent =
    | "fix_typo"
    | "change_text"
    | "add_element"
    | "remove_element"
    | "change_photo"
    | "change_background"
    | "style_colors"
    | "other";

export type QueueItem = {
    id: string;
    intent: EditIntent;
    value: string;
    originalValue?: string; // For text changes
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    sourceImageUrl: string;
    onGenerate: (queue: QueueItem[]) => void;
    isGenerating?: boolean;
};

const INTENTS: { id: EditIntent; label: string; icon: string; helper: string; placeholder: string }[] = [
    {
        id: "fix_typo",
        label: "Fix Typo",
        icon: "📝",
        helper: "Tell me the typo and what it should say.",
        placeholder: "Change 'Plumming' to 'Plumbing'"
    },
    {
        id: "change_text",
        label: "Change Text",
        icon: "✏️",
        helper: "What should the text say instead?",
        placeholder: "Headline: 'Trusted Local Services'"
    },
    {
        id: "add_element",
        label: "Add Element",
        icon: "➕",
        helper: "What do you want to add? (Badge, Logo, etc)",
        placeholder: "Add a 'Free Estimates' badge"
    },
    {
        id: "remove_element",
        label: "Remove Element",
        icon: "➖",
        helper: "Which element should be removed?",
        placeholder: "Remove the '24/7' badge"
    },
    {
        id: "change_photo",
        label: "Change Photo",
        icon: "🖼",
        helper: "Describe what to replace (Subject or Background).",
        placeholder: "Replace subject with uploaded photo..."
    },
    {
        id: "change_background",
        label: "Change Background",
        icon: "🌆",
        helper: "What kind of background should this have?",
        placeholder: "Modern office with blue lighting..."
    },
    {
        id: "style_colors",
        label: "Style & Colors",
        icon: "🎨",
        helper: "Describe the look/color palette you want.",
        placeholder: "Make it darker / High contrast..."
    },
    {
        id: "other",
        label: "Other",
        icon: "💬",
        helper: "Tell me exactly what you want to change.",
        placeholder: "Describe your change..."
    }
];

export default function EditModeModal({ isOpen, onClose, sourceImageUrl, onGenerate, isGenerating }: Props) {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [selectedIntent, setSelectedIntent] = useState<EditIntent | null>(null);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setQueue([]);
            setSelectedIntent(null);
            setInputValue("");
        }
    }, [isOpen]);

    // Focus input when intent selected
    useEffect(() => {
        if (selectedIntent && inputRef.current) {
            inputRef.current.focus();
        }
    }, [selectedIntent]);

    if (!isOpen) return null;

    const activeBubble = INTENTS.find(i => i.id === selectedIntent);

    const handleAddChange = () => {
        if (!inputValue.trim() || !selectedIntent) return;

        const newItem: QueueItem = {
            id: Date.now().toString(),
            intent: selectedIntent,
            value: inputValue.trim()
        };

        if (queue.length >= 3) {
            alert("Maximum 3 changes allowed per generation.");
            return;
        }

        setQueue([...queue, newItem]);
        setInputValue("");
        setSelectedIntent(null); // Reset after adding
    };

    const handleRemoveItem = (id: string) => {
        setQueue(queue.filter(q => q.id !== id));
    };

    const handleRunGeneration = () => {
        if (queue.length === 0) return;
        onGenerate(queue);
        // Do NOT close here, let parent handle it on success or let user close
    };


    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4" role="dialog">
            <div className="flex h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl flex-col md:flex-row">

                {/* Left: Preview (Locked) */}
                <div className="relative flex-1 bg-neutral-900/50 min-h-[300px] flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10 p-6">
                    <div className="absolute top-4 left-4 z-10 rounded-lg bg-black/60 px-3 py-1 text-xs font-mono text-white/50 border border-white/5 backdrop-blur-md">
                        SOURCE IMAGE (LOCKED)
                    </div>
                    <div className="relative h-full w-full max-w-md aspect-[9/16] md:max-w-full">
                        <Image
                            src={sourceImageUrl}
                            alt="Source to edit"
                            fill
                            className="object-contain"
                            unoptimized
                        />
                        {/* Overlay Queue Visualization? Optional */}
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="flex w-full md:w-[450px] flex-col bg-neutral-900 border-l border-white/5">

                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/10 p-4 bg-black/20">
                        <div className="text-sm font-bold text-white">Edit Mode</div>
                        <button onClick={onClose} className="text-white/50 hover:text-white">✕</button>
                    </div>

                    {/* Queue List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {queue.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center p-6 border-2 border-dashed border-white/5 rounded-xl">
                                <span className="text-2xl opacity-20 mb-2">✨</span>
                                <p className="text-sm text-white/40">Select a bubble below to add changes.</p>
                                <p className="text-xs text-white/20 mt-1">Add up to 3 changes</p>
                            </div>
                        )}

                        {queue.map((item, idx) => {
                            const intentDef = INTENTS.find(i => i.id === item.intent);
                            return (
                                <div key={item.id} className="group relative flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg">
                                        {intentDef?.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-lime-400 uppercase tracking-wider">{intentDef?.label}</span>
                                            <span className="text-[10px] text-white/30 font-mono">#{idx + 1}</span>
                                        </div>
                                        <div className="text-sm text-white/90 mt-1 truncate">{item.value}</div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="absolute top-2 right-2 p-1 text-white/20 hover:text-red-400 transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer / Input Area */}
                    <div className="bg-black border-t border-white/10 p-4 space-y-4">

                        {/* Selected Intent Input */}
                        {selectedIntent && activeBubble ? (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{activeBubble.icon}</span>
                                        <span className="text-sm font-bold text-white">{activeBubble.label}</span>
                                    </div>
                                    <button
                                        onClick={() => setSelectedIntent(null)}
                                        className="text-xs text-red-300 hover:text-red-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <div className="text-xs text-white/50 mb-3">{activeBubble.helper}</div>
                                <div className="flex gap-2">
                                    <input
                                        ref={inputRef}
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={activeBubble.placeholder}
                                        className="flex-1 rounded-lg border border-white/20 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400"
                                        onKeyDown={(e) => e.key === "Enter" && handleAddChange()}
                                    />
                                    <button
                                        onClick={handleAddChange}
                                        disabled={!inputValue.trim()}
                                        className="rounded-lg bg-white/10 px-4 py-2 text-sm font-bold text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Bubble Grid */
                            <div className={`grid grid-cols-4 gap-2 ${queue.length >= 3 ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                                {INTENTS.map((intent) => (
                                    <button
                                        key={intent.id}
                                        onClick={() => setSelectedIntent(intent.id)}
                                        disabled={queue.length >= 3}
                                        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/5 bg-white/5 p-2 hover:bg-lime-400/10 hover:border-lime-400/50 transition cursor-pointer disabled:cursor-not-allowed"
                                    >
                                        <span className="text-xl mb-1">{intent.icon}</span>
                                        <span className="text-[10px] uppercase font-bold text-white/70 text-center leading-tight">
                                            {intent.label.replace(' ', '\n')}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Main Action */}
                        <div className="pt-2">
                            <button
                                onClick={handleRunGeneration}
                                disabled={queue.length === 0 || isGenerating}
                                className="w-full rounded-xl bg-lime-400 py-3 text-sm font-bold text-black hover:bg-lime-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isGenerating && <span className="animate-spin text-lg">⏳</span>}
                                {isGenerating ? "Processing Edits..." : (queue.length > 0 ? `Apply ${queue.length} Changes` : "Queue changes to generate")}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
