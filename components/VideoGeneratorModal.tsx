"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X, Play, Wand2, Film } from "lucide-react";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    sourceImage: string; // URL
    sourceImageId?: string; // DB ID
    userId?: string;
};

export default function VideoGeneratorModal({ isOpen, onClose, sourceImage, sourceImageId, userId }: Props) {
    const [prompt, setPrompt] = useState("");
    const [dialogue, setDialogue] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isGenerating) {
            setTimer(0);
            interval = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isGenerating]);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        setError(null);
        setResultUrl(null);

        try {
            const res = await fetch("/api/generate-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: sourceImage,
                    prompt,
                    dialogue,
                    userId,
                    sourceImageId
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to generate video");

            setResultUrl(data.videoUrl);
        } catch (e: any) {
            console.error("Video Error:", e);
            setError(e.message || "Something went wrong.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#121212] flex flex-col md:flex-row shadow-2xl">

                {/* Visual Preview Side */}
                <div className="relative h-64 md:h-auto md:w-1/2 bg-black flex items-center justify-center border-b md:border-b-0 md:border-r border-white/10">
                    {resultUrl ? (
                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <video
                                src={resultUrl}
                                controls
                                autoPlay
                                loop
                                className="max-h-full max-w-full object-contain"
                            />
                        </div>
                    ) : (
                        <div className="relative w-full h-full p-8 flex items-center justify-center">
                            <Image
                                src={sourceImage}
                                alt="Source"
                                fill
                                className={`object-contain transition-opacity duration-700 ${isGenerating ? "opacity-50 animate-pulse" : "opacity-100"}`}
                                unoptimized
                            />
                            {isGenerating && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <div className="h-12 w-12 rounded-full border-4 border-lime-400 border-t-transparent animate-spin mb-4 shadow-[0_0_20px_rgba(183,255,0,0.4)]" />
                                    <div className="text-lime-400 font-mono text-sm tracking-widest animate-pulse">RENDERING SCENE...</div>
                                    <div className="text-lime-400/60 font-mono text-xs mt-2">{timer}s</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Controls Side */}
                <div className="flex flex-col p-6 md:p-8 md:w-1/2 relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>

                    <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                        <Film className="text-lime-400" size={24} />
                        Animate Scene
                    </h2>
                    <p className="text-sm text-white/50 mb-8">Bring this image to life with AI video generation.</p>

                    <div className="space-y-6 flex-1">
                        <div>
                            <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                                WHAT HAPPENS?
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Describe the motion (e.g., 'The camera pans slowly, the subject smiles and waves')..."
                                className="w-full h-24 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 focus:border-lime-400/50 focus:outline-none focus:ring-1 focus:ring-lime-400/20 resize-none"
                                disabled={isGenerating}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                                AUDIO / DIALOGUE (Optional)
                            </label>
                            <input
                                type="text"
                                value={dialogue}
                                onChange={(e) => setDialogue(e.target.value)}
                                placeholder="What do we hear? (e.g. 'Hello there!')"
                                className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 focus:border-lime-400/50 focus:outline-none focus:ring-1 focus:ring-lime-400/20"
                                disabled={isGenerating}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg bg-red-950/50 border border-red-500/30 p-3 text-xs text-red-200">
                            {error}
                        </div>
                    )}

                    <div className="mt-8 pt-6 border-t border-white/10">
                        <button
                            onClick={handleGenerate}
                            disabled={!prompt.trim() || isGenerating}
                            className={`w-full py-4 rounded-xl font-bold text-black flex items-center justify-center gap-2 transition-all shadow-lg ${!prompt.trim() || isGenerating
                                ? "bg-white/10 text-white/20 cursor-not-allowed"
                                : "bg-lime-400 hover:bg-lime-300 hover:scale-[1.02] shadow-lime-400/20"
                                }`}
                        >
                            {isGenerating ? (
                                "Generating Video..."
                            ) : (
                                <>
                                    <Wand2 size={18} />
                                    Generate Video
                                </>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
