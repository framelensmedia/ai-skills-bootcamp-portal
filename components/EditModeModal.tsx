// ... imports
import { useState, useRef } from "react";
import Image from "next/image";
import { Sparkles, Send, X, Paperclip, Trash2 } from "lucide-react";
import LoadingHourglass from "./LoadingHourglass";
import LoadingOrb from "./LoadingOrb";

export type QueueItem = any;

type Props = {
    isOpen: boolean;
    onClose: () => void;
    sourceImageUrl: string;
    onGenerate: (prompt: string, images: File[]) => void;
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
    const [images, setImages] = useState<File[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const p = input.trim();
        // Allow submitting if there are images, even if prompt is empty? Usually prompt is needed.
        if (!p || isGenerating) return;
        onGenerate(p, images);
        setInput("");
        setImages([]);
    };

    const handleSuggestion = (s: string) => {
        if (isGenerating) return;
        onGenerate(s, images); // Pass current images if any
        setInput("");
        setImages([]);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setImages(prev => [...prev, ...newFiles].slice(0, 4)); // Max 4 images
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 md:p-4" role="dialog">
            <div className="flex h-[100dvh] w-full max-w-5xl overflow-hidden bg-black shadow-2xl flex-col md:flex-row-reverse md:h-[80vh] md:rounded-2xl md:border md:border-white/10">

                {/* Left: Preview (Locked) */}
                <div className="relative h-[45vh] w-full bg-neutral-900/50 flex items-center justify-center border-b border-white/10 p-6 md:h-auto md:flex-1 md:border-b-0 md:border-l">
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
                        {/* Loading Overlay */}
                        {isGenerating && (
                            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm transition-all duration-500">
                                <LoadingOrb />
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Chat/Controls */}
                <div className="flex flex-1 w-full flex-col bg-neutral-900 md:flex-none md:w-[400px]">

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

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col justify-end p-4 space-y-4 overflow-y-auto">

                        <div className="flex-1 flex items-center justify-center text-center opacity-30 px-6">
                            <div>
                                <p className="text-sm">Describe what you want to change.</p>
                                <p className="text-xs mt-1">E.g. Fix a typo, change the background, adjust the vibe...</p>
                            </div>
                        </div>

                        {/* Image Previews */}
                        {images.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto py-2">
                                {images.map((file, i) => (
                                    <div key={i} className="relative h-16 w-16 shrink-0 rounded-lg border border-white/10 overflow-hidden group">
                                        <img src={URL.createObjectURL(file)} className="h-full w-full object-cover" alt="preview" />
                                        <button
                                            onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

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
                            <textarea
                                className="w-full rounded-xl bg-black border border-white/10 p-4 pr-20 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#B7FF00]/50 transition-all resize-none min-h-[60px] max-h-[120px]"
                                placeholder={isGenerating ? "Processing..." : "Type instruction..."}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={isGenerating}
                                rows={2}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit();
                                    }
                                }}
                            />

                            <div className="absolute right-2 top-2 flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={isGenerating || images.length >= 4}
                                    className="p-2 rounded-lg text-white/50 hover:bg-white/10 disabled:opacity-30 transition-colors"
                                >
                                    <Paperclip size={18} />
                                </button>
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isGenerating}
                                    className="p-2 rounded-lg text-[#B7FF00] hover:bg-[#B7FF00]/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                >
                                    {isGenerating ? <div className="h-4 w-4"><LoadingHourglass className="h-4 w-4 text-[#B7FF00]" /></div> : <Send size={18} />}
                                </button>
                            </div>
                            <input
                                type="file"
                                ref={fileRef}
                                onChange={handleFileChange}
                                className="hidden"
                                multiple
                                accept="image/*"
                            />
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
