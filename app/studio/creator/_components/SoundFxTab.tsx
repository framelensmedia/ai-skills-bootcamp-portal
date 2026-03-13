import { useState, useRef } from "react";
import { Zap, Download, Loader2, Volume2, Play, Pause, Video, Upload, X, Library } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import LibraryVideoPickerModal from "@/components/LibraryVideoPickerModal";
import { proxyVideoUrl } from "@/lib/videoProxy";

type SoundFxTabProps = {
    userCredits: number | null;
    isAdmin: boolean;
    onCreditsUsed: (amount: number) => void;
};

const SINGLE_COST = 2;
const AUTO_COST = 5;

export default function SoundFxTab({ userCredits, isAdmin, onCreditsUsed }: SoundFxTabProps) {
    const [mode, setMode] = useState<"single" | "auto">("single");
    const [prompt, setPrompt] = useState("");
    const [durationSeconds, setDurationSeconds] = useState(5);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [isLibraryVideo, setIsLibraryVideo] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [libraryModalOpen, setLibraryModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [history, setHistory] = useState<{ prompt: string; url: string; mode: string; isVideo?: boolean }[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentCost = mode === "single" ? SINGLE_COST : AUTO_COST;
    const hasCredits = (userCredits ?? 0) >= currentCost || isAdmin;

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 50 * 1024 * 1024) {
                setError("Video file is too large (max 50MB)");
                return;
            }
            setVideoFile(file);
            setVideoUrl(URL.createObjectURL(file));
            setIsLibraryVideo(false);
            setError(null);
        }
    }

    async function uploadVideo(file: File): Promise<string> {
        setUploading(true);
        try {
            const res = await fetch("/api/sign-upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: file.name, fileType: file.type }),
            });
            const { signedUrl, publicUrl } = await res.json();

            const uploadRes = await fetch(signedUrl, {
                method: "PUT",
                body: file,
                headers: { "Content-Type": file.type },
            });

            if (!uploadRes.ok) throw new Error("Failed to upload video");
            return publicUrl;
        } finally {
            setUploading(false);
        }
    }

    async function handleGenerate() {
        if (mode === "single" && !prompt.trim()) { setError("Please describe the sound effect."); return; }
        if (mode === "auto" && !videoUrl) { setError("Please upload or select a video."); return; }
        if (!hasCredits) { setError(`Not enough credits. Need ${currentCost}.`); return; }

        setGenerating(true);
        setError(null);
        setAudioUrl(null);

        try {
            let finalVideoUrl = videoUrl;
            if (mode === "auto" && videoFile && !isLibraryVideo) {
                finalVideoUrl = await uploadVideo(videoFile);
            }

            const res = await fetch("/api/generate-soundfx", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    prompt: prompt.trim(), 
                    video_url: finalVideoUrl,
                    duration_seconds: durationSeconds 
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to generate.");

            if (data.videoUrl) {
                // Hunyuan Auto Foley returns video-with-audio
                setResultVideoUrl(data.videoUrl);
                setAudioUrl(null);
                setHistory(prev => [{ prompt: prompt.trim() || "Auto-generated from video", url: data.videoUrl, mode, isVideo: true }, ...prev.slice(0, 9)]);
            } else {
                // ElevenLabs Single returns audio
                setAudioUrl(data.audioUrl);
                setResultVideoUrl(null);
                setHistory(prev => [{ prompt: prompt.trim(), url: data.audioUrl, mode, isVideo: false }, ...prev.slice(0, 9)]);
            }
            onCreditsUsed(currentCost);
        } catch (e: any) {
            setError(e.message || "Something went wrong.");
        } finally {
            setGenerating(false);
        }
    }

    function togglePlay(url: string) {
        if (!audioRef.current) {
            audioRef.current = new Audio(url);
            audioRef.current.onended = () => setIsPlaying(false);
        }

        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            if (audioRef.current.src !== url) {
                audioRef.current.src = url;
            }
            audioRef.current.play();
            setIsPlaying(true);
        }
    }

    function handleDownload(url: string, label: string) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `sound-effect-${label.slice(0, 30).replace(/\s+/g, "-")}.mp3`;
        a.click();
    }

    return (
        <div className="w-full max-w-3xl mx-auto space-y-8 py-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                        <Zap className="text-rose-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Sound Effects Generator</h2>
                        <p className="text-xs text-white/40">Generate context-aware sound effects · {currentCost} credits</p>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl self-start">
                    <button
                        onClick={() => setMode("single")}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${mode === "single" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                    >
                        Single
                    </button>
                    <button
                        onClick={() => setMode("auto")}
                        className={`px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${mode === "auto" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                    >
                        Auto (Foley)
                    </button>
                </div>
            </div>

            {/* Input Overlay */}
            <div className="rounded-2xl border border-white/10 bg-[#111] p-6 space-y-6 shadow-xl ring-1 ring-white/5">
                {mode === "auto" && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Reference Video</label>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/60 transition-all"
                                >
                                    <Upload size={12} /> Upload
                                </button>
                                <button 
                                    onClick={() => setLibraryModalOpen(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-bold text-rose-400 transition-all"
                                >
                                    <Library size={12} /> From Library
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="video/*" className="hidden" />
                            </div>
                        </div>

                        {!videoUrl ? (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="group relative w-full h-48 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-rose-400/30 transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload className="text-white/40 group-hover:text-rose-400" size={24} />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white/60">Drop video or click to upload</p>
                                    <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">MP4, MOV up to 50MB</p>
                                </div>
                            </div>
                        ) : (
                            <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black aspect-video max-h-64 mx-auto">
                                {videoUrl && <video src={videoUrl} controls className="w-full h-full object-contain" />}
                                <button 
                                    onClick={() => { setVideoFile(null); setVideoUrl(null); setIsLibraryVideo(false); }}
                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white/70 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={16} />
                                </button>
                                {isLibraryVideo && (
                                    <div className="absolute top-2 left-2 px-2 py-1 rounded bg-rose-500 text-[8px] font-bold text-white uppercase tracking-wider">
                                        Library
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">
                        {mode === "single" ? "Describe Your Sound Effect" : "Description (Optional)"}
                    </label>
                    <textarea
                        rows={2}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={mode === "single" ? "e.g. A thunderstorm with heavy rain..." : "e.g. Enhance the sword clashing sounds..."}
                        className="w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-rose-400/50 focus:ring-1 focus:ring-rose-400/20 resize-none leading-relaxed"
                    />
                </div>

                {mode === "single" && (
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Duration</label>
                            <span className="text-sm font-bold text-rose-400">{durationSeconds}s</span>
                        </div>
                        <input
                            type="range"
                            min={1}
                            max={22}
                            value={durationSeconds}
                            onChange={(e) => setDurationSeconds(Number(e.target.value))}
                            className="w-full h-1.5 rounded-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-400 cursor-pointer"
                        />
                    </div>
                )}

                {error && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={generating || uploading || !hasCredits || (mode === "single" && !prompt.trim()) || (mode === "auto" && !videoUrl)}
                    className="w-full py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20"
                >
                    {generating || uploading ? (
                        <><Loader2 size={18} className="animate-spin" /> {uploading ? "Uploading Video..." : "Generating Audio..."}</>
                    ) : (
                        <><Zap size={18} /> Generate {mode === "auto" ? "Foley" : "Sound FX"} ({isAdmin ? "∞" : currentCost} Cr)</>
                    )}
                </button>
            </div>

            {/* Current Result */}
            {(audioUrl || resultVideoUrl) && (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Volume2 size={16} className="text-rose-400" />
                            <span className="text-sm font-bold text-white">Latest Result</span>
                            {resultVideoUrl && (
                                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full font-bold uppercase">Video + Audio</span>
                            )}
                        </div>
                        <button
                            onClick={() => handleDownload(audioUrl || resultVideoUrl!, prompt || "foley")}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 font-bold text-xs transition-all"
                        >
                            <Download size={14} /> Download
                        </button>
                    </div>
                    {prompt && <p className="text-xs text-white/50 truncate">"{prompt}"</p>}
                    {resultVideoUrl ? (
                        <video
                            controls
                            src={proxyVideoUrl(resultVideoUrl)}
                            className="w-full rounded-xl"
                            playsInline
                            // @ts-ignore
                            webkit-playsinline="true"
                            preload="auto"
                        />
                    ) : audioUrl ? (
                        <audio controls src={audioUrl} className="w-full h-10 rounded-lg opacity-80" />
                    ) : null}
                </div>
            )}

            {/* History */}
            {history.length > 1 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-white/30 uppercase tracking-wider">Previous generations this session</h3>
                    <div className="space-y-2">
                        {history.slice(1).map((item, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#111] px-4 py-3">
                                {!item.isVideo && (
                                    <button
                                        onClick={() => togglePlay(item.url)}
                                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-rose-500/20 flex items-center justify-center text-white/50 hover:text-rose-400 transition-all shrink-0"
                                    >
                                        <Play size={12} />
                                    </button>
                                )}
                                <span className="text-xs text-white/50 flex-1 truncate">
                                    <span className="text-[10px] font-bold text-rose-400/50 mr-2 uppercase">{item.mode}</span>
                                    "{item.prompt}"
                                </span>
                                <button
                                    onClick={() => handleDownload(item.url, item.prompt)}
                                    className="text-white/30 hover:text-white transition-colors shrink-0"
                                >
                                    <Download size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <LibraryVideoPickerModal 
                isOpen={libraryModalOpen}
                onClose={() => setLibraryModalOpen(false)}
                onSelect={(url) => {
                    setVideoUrl(url);
                    setVideoFile(null);
                    setIsLibraryVideo(true);
                    setError(null);
                }}
            />
        </div>
    );
}
