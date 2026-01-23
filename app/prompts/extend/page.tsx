"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Wand2, Film, Play, Pause, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";

export default function ExtendVideoPage() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const videoUrl = searchParams.get("video") || "";
    const initialPrompt = searchParams.get("prompt") || "";

    const [prompt, setPrompt] = useState(initialPrompt);
    const [dialogue, setDialogue] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [timer, setTimer] = useState(0);

    // Video preview controls
    const videoRef = useRef<HTMLVideoElement>(null);
    const resultVideoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);

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

    if (!videoUrl) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">No Video Provided</h1>
                    <p className="text-white/60 mb-6">Please select a video to extend from your library.</p>
                    <button
                        onClick={() => router.push("/library")}
                        className="px-6 py-3 bg-lime-400 text-black font-bold rounded-xl hover:bg-lime-300 transition"
                    >
                        Go to Library
                    </button>
                </div>
            </div>
        );
    }

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
                    inputVideo: videoUrl,
                    prompt,
                    dialogue,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to extend video");

            setResultUrl(data.videoUrl);
        } catch (e: any) {
            console.error("Video Extension Error:", e);
            setError(e.message || "Something went wrong.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <header className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition"
                    >
                        <ArrowLeft size={20} />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Film className="text-lime-400" size={24} />
                        Extend Video
                    </h1>
                    <div className="w-16" /> {/* Spacer for centering */}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Left: Video Preview */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">
                                Original Video
                            </h2>
                            <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-white/10">
                                <video
                                    ref={videoRef}
                                    src={videoUrl}
                                    className="w-full h-full object-contain"
                                    loop
                                    playsInline
                                    muted={isMuted}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                />
                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full">
                                    <button
                                        onClick={() => {
                                            if (videoRef.current) {
                                                if (isPlaying) {
                                                    videoRef.current.pause();
                                                } else {
                                                    videoRef.current.play();
                                                }
                                            }
                                        }}
                                        className="text-white hover:text-lime-400 transition"
                                    >
                                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsMuted(!isMuted);
                                            if (videoRef.current) {
                                                videoRef.current.muted = !isMuted;
                                            }
                                        }}
                                        className="text-white hover:text-lime-400 transition"
                                    >
                                        {isMuted ? <Volume2 size={20} className="opacity-50" /> : <Volume2 size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Result Video */}
                        {resultUrl && (
                            <div>
                                <h2 className="text-sm font-bold text-lime-400 uppercase tracking-wider mb-3">
                                    Extended Video ✨
                                </h2>
                                <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-lime-400/30">
                                    <video
                                        ref={resultVideoRef}
                                        src={resultUrl}
                                        controls
                                        autoPlay
                                        loop
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                                <div className="mt-4 flex gap-3">
                                    <a
                                        href={resultUrl}
                                        download
                                        className="flex-1 py-3 bg-lime-400 text-black font-bold rounded-xl hover:bg-lime-300 transition text-center"
                                    >
                                        Download
                                    </a>
                                    <button
                                        onClick={() => router.push("/library")}
                                        className="flex-1 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition border border-white/10"
                                    >
                                        View in Library
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Controls */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider mb-3">
                                Extension Instructions
                            </h2>
                            <p className="text-sm text-white/50 mb-4">
                                Describe what should happen next in the video. The AI will extend your video based on these instructions.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                                        What Happens Next?
                                    </label>
                                    <textarea
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Describe the continuation (e.g., 'The camera continues panning right, revealing a stunning sunset')..."
                                        className="w-full h-32 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 focus:border-lime-400/50 focus:outline-none focus:ring-1 focus:ring-lime-400/20 resize-none"
                                        disabled={isGenerating}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                                        Audio / Dialogue (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={dialogue}
                                        onChange={(e) => setDialogue(e.target.value)}
                                        placeholder="What do we hear? (e.g. 'The wind howls')"
                                        className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white placeholder:text-white/20 focus:border-lime-400/50 focus:outline-none focus:ring-1 focus:ring-lime-400/20"
                                        disabled={isGenerating}
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-red-950/50 border border-red-500/30 p-4 text-sm text-red-200">
                                {error}
                            </div>
                        )}

                        {isGenerating && (
                            <div className="rounded-xl bg-lime-400/10 border border-lime-400/30 p-6 text-center">
                                <div className="h-12 w-12 mx-auto rounded-full border-4 border-lime-400 border-t-transparent animate-spin mb-4 shadow-[0_0_20px_rgba(183,255,0,0.4)]" />
                                <div className="text-lime-400 font-mono text-sm tracking-widest animate-pulse mb-2">
                                    EXTENDING VIDEO...
                                </div>
                                <div className="text-lime-400/60 font-mono text-xs">{timer}s</div>
                                <p className="text-white/40 text-xs mt-3">This may take 1-2 minutes</p>
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
                                "Generating Extended Video..."
                            ) : (
                                <>
                                    <Wand2 size={18} />
                                    Extend Video
                                </>
                            )}
                        </button>

                        <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                            <h3 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2">
                                💡 Tips
                            </h3>
                            <ul className="space-y-2 text-sm text-white/60">
                                <li>• Be specific about camera movements and actions</li>
                                <li>• Keep the style consistent with the original video</li>
                                <li>• Extensions typically add 5-8 seconds of footage</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
