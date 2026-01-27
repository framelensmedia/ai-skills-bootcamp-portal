"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { X, Play, Wand2, Film, Maximize2 } from "lucide-react";



type Props = {
    isOpen: boolean;
    onClose: () => void;
    sourceImage?: string; // URL
    sourceImageId?: string; // DB ID
    sourceVideo?: string; // URL for Video-to-Video
    userId?: string;
    initialPrompt?: string;
};

export default function VideoGeneratorModal({ isOpen, onClose, sourceImage, sourceImageId, sourceVideo, userId, initialPrompt }: Props) {
    const [prompt, setPrompt] = useState(initialPrompt || "");
    const [dialogue, setDialogue] = useState("");


    const [isGenerating, setIsGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);

    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && initialPrompt) {
            setPrompt(initialPrompt);
        }
    }, [isOpen, initialPrompt]);

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
                    inputVideo: sourceVideo, // Pass video for V2V
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
            {/* Zoom Overlay */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in duration-200"
                    onClick={() => setZoomedImage(null)}
                >
                    <button
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition z-50"
                    >
                        <X size={24} />
                    </button>
                    <div className="relative w-full h-full max-w-5xl max-h-[90vh] p-4 flex items-center justify-center">
                        <Image
                            src={zoomedImage}
                            alt="Full Screen Start Frame"
                            fill
                            className="object-contain"
                            unoptimized
                            quality={100}
                        />
                    </div>
                </div>
            )}

            <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#09090b] flex flex-col-reverse md:flex-row shadow-2xl h-[90vh] md:h-[800px]">

                {/* Left (Desktop) / Bottom (Mobile): Controls */}
                <div className="w-full md:w-[40%] lg:w-[35%] flex flex-col bg-[#121212] border-t md:border-t-0 md:border-r border-white/10 overflow-y-auto">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#121212]/95 backdrop-blur z-20">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <Film className="text-lime-400" size={20} />
                                {sourceVideo ? "Edit Video" : "Video Remix"}
                            </h2>
                            <p className="text-xs text-white/40">Using Veo 3.1 & Ingredients</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="p-6 space-y-8 flex-1">
                        {/* 1. Context / Prompt */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-2">
                                <Wand2 size={12} />
                                {sourceVideo ? "Edit Instructions" : "What happens?"}
                            </label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder={sourceVideo ? "Describe how to change the video (e.g. 'Make it look like a 1980s film', 'Change the background to a cyberpunk city')..." : "Describe the motion and action (e.g. 'A cinematic slow motion shot of the character walking forward...')..."}
                                className="w-full h-32 rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white placeholder:text-white/20 focus:border-lime-400/50 focus:outline-none focus:ring-1 focus:ring-lime-400/20 resize-none leading-relaxed"
                                disabled={isGenerating}
                            />
                        </div>

                        {/* 2. Ingredients */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Cast & Ingredients</label>
                                <span className="text-[10px] text-lime-400/80 bg-lime-400/10 px-2 py-0.5 rounded-full">New</span>
                            </div>

                            {/* Start Frame (Read Only Context) - OR Input Video */}
                            <div
                                onClick={() => sourceImage && !sourceVideo && setZoomedImage(sourceImage)}
                                className={`rounded-xl border border-white/10 bg-white/5 p-3 flex items-center gap-3 transition-colors ${sourceImage && !sourceVideo ? "cursor-pointer hover:bg-white/10 group" : ""}`}
                            >
                                <div className="relative h-12 w-16 rounded-lg overflow-hidden bg-black shrink-0 border border-white/10 flex items-center justify-center">
                                    {sourceVideo ? (
                                        <video src={sourceVideo} className="w-full h-full object-cover" muted />
                                    ) : sourceImage ? (
                                        <>
                                            <Image src={sourceImage} alt="Context" fill className="object-cover" unoptimized />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <Maximize2 size={12} className="text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full bg-white/10" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-white truncate">{sourceVideo ? "Input Video" : "Start Frame"}</div>
                                    <div className="text-[10px] text-white/40 truncate">Context from original {sourceVideo ? "video" : "image"}</div>
                                </div>
                            </div>


                            {/* Uploads */}



                        </div>

                        {/* 3. Audio */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-white/40 uppercase tracking-wider">Dialogue</label>
                            <input
                                type="text"
                                value={dialogue}
                                onChange={(e) => setDialogue(e.target.value)}
                                placeholder="Optional spoken dialogue..."
                                className="w-full rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white placeholder:text-white/20 focus:border-lime-400/50 focus:outline-none focus:ring-1 focus:ring-lime-400/20"
                                disabled={isGenerating}
                            />
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-white/10 bg-[#121212] sticky bottom-0 z-20">
                        {error && (
                            <div className="mb-4 text-xs text-red-400 bg-red-950/30 border border-red-500/20 p-3 rounded-lg">
                                {error}
                            </div>
                        )}
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
                                    {sourceVideo ? "Generate Edit" : "Generate Remix"}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right (Desktop) / Top (Mobile): Preview */}
                <div className="relative w-full md:w-[60%] lg:w-[65%] bg-black flex flex-col">
                    {/* Mobile Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-50 md:hidden h-10 w-10 flex items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md border border-white/10 hover:bg-black/70 transition-all"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex-1 relative w-full h-full flex items-center justify-center p-4 md:p-8">
                        {resultUrl ? (
                            <div className="relative w-full h-full flex items-center justify-center bg-black">
                                <video
                                    src={resultUrl}
                                    controls
                                    autoPlay
                                    loop
                                    className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
                                />
                            </div>
                        ) : (
                            <div className="relative w-full h-full p-4 md:p-8 flex items-center justify-center">
                                <div className="relative w-full h-full max-h-[600px] aspect-video rounded-xl overflow-hidden border border-white/5 bg-zinc-900/50 flex items-center justify-center">
                                    {sourceVideo ? (
                                        <video
                                            src={sourceVideo}
                                            className={`w-full h-full object-contain ${isGenerating ? "opacity-30 blur-sm" : "opacity-100"}`}
                                            muted
                                            loop
                                            autoPlay
                                            playsInline
                                        />
                                    ) : sourceImage ? (
                                        <Image
                                            src={sourceImage}
                                            alt="Start Frame"
                                            fill
                                            className={`object-contain transition-opacity duration-700 ${isGenerating ? "opacity-30 blur-sm" : "opacity-100"}`}
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="text-white/20 font-mono text-sm">No Start Frame</div>
                                    )}

                                    {/* Loading Overlay */}
                                    {isGenerating && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                            <div className="relative">
                                                <div className="absolute inset-0 bg-lime-400/20 blur-xl rounded-full" />
                                                <div className="relative h-16 w-16 rounded-full border-4 border-lime-400 border-t-transparent animate-spin shadow-[0_0_30px_rgba(183,255,0,0.4)]" />
                                            </div>
                                            <div className="mt-6 text-lime-400 font-bold tracking-widest animate-pulse">GENERATING VIDEO</div>
                                            <div className="text-lime-400/60 font-mono text-xs mt-2">{timer}s</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
