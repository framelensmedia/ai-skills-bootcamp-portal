"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { Loader2, Download, Upload, X, Wand2, Plus, Library, Music, ImageIcon } from "lucide-react";
import LibraryImagePickerModal from "@/components/LibraryImagePickerModal";
import LibraryAudioPickerModal from "@/components/LibraryAudioPickerModal";
import { uploadFile } from "@/lib/upload";
import { proxyVideoUrl } from "@/lib/videoProxy";

type LipSyncTabProps = {
    userCredits: number | null;
    isAdmin: boolean;
    onCreditsUsed: (amount: number) => void;
};

const COST = 30;

export default function LipSyncTab({ userCredits, isAdmin, onCreditsUsed }: LipSyncTabProps) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioFileName, setAudioFileName] = useState<string | null>(null);
    
    const [imagePickerOpen, setImagePickerOpen] = useState(false);
    const [audioPickerOpen, setAudioPickerOpen] = useState(false);
    
    const [generating, setGenerating] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingAudio, setUploadingAudio] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    
    // New creative controls
    const [expression, setExpression] = useState<"default" | "happy">("default");
    const [talkingStyle, setTalkingStyle] = useState<"stable" | "expressive">("stable");
    
    const imgInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    const hasCredits = (userCredits ?? 0) >= COST || isAdmin;

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setUploadingImage(true);
        setError(null);

        try {
            const url = await uploadFile(file);
            setImageUrl(url);
        } catch (err: any) {
            setError(err.message || "Failed to upload image");
        } finally {
            setUploadingImage(false);
            e.target.value = "";
        }
    }

    async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setUploadingAudio(true);
        setError(null);
        setAudioFileName(file.name);

        try {
            const url = await uploadFile(file);
            setAudioUrl(url);
        } catch (err: any) {
            setError(err.message || "Failed to upload audio");
            setAudioFileName(null);
        } finally {
            setUploadingAudio(false);
            e.target.value = "";
        }
    }

    async function handleGenerate() {
        if (!imageUrl) { setError("Please select a reference image."); return; }
        if (!audioUrl) { setError("Please select an audio file."); return; }
        if (!hasCredits) { setError(`You need at least ${COST} credits.`); return; }

        setGenerating(true);
        setError(null);
        setVideoUrl(null);

        try {
            const res = await fetch("/api/generate-lipsync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    imageUrl, 
                    audioUrl,
                    expression,
                    talkingStyle
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Generation failed");
            setVideoUrl(data.videoUrl);
            onCreditsUsed(COST);
        } catch (e: any) {
            setError(e.message || "Something went wrong");
        } finally {
            setGenerating(false);
        }
    }

    // Trigger load on source change
    useEffect(() => {
        if (videoUrl && videoRef.current) {
            videoRef.current.load();
        }
    }, [videoUrl]);

    function handleDownload() {
        if (!videoUrl) return;
        const a = document.createElement("a");
        a.href = videoUrl;
        a.download = `lipsync-${Date.now()}.mp4`;
        a.click();
    }

    return (
        <div className="w-full max-w-3xl mx-auto space-y-8 py-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <Music className="text-blue-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Lip Sync</h2>
                        <p className="text-xs text-white/40">Animate a photo with reference audio · {COST} credits</p>
                    </div>
                </div>
                <div className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                    AI Studio
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image Selection */}
                <div className="rounded-2xl border border-white/10 bg-[#111] p-6 space-y-4 shadow-xl ring-1 ring-white/5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Reference Photo</label>
                    </div>

                    <div 
                        className={`group relative aspect-square rounded-xl overflow-hidden border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3
                            ${imageUrl ? 'border-transparent bg-black' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}
                        `}
                    >
                        {imageUrl ? (
                            <>
                                <Image src={imageUrl} alt="Reference" fill className="object-cover" unoptimized />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button 
                                        onClick={() => setImageUrl(null)}
                                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </>
                        ) : uploadingImage ? (
                            <div className="flex flex-col items-center gap-4 animate-pulse text-blue-400/50">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Uploading...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-6 p-4">
                                <div className="w-16 h-16 rounded-full bg-blue-500/5 flex items-center justify-center">
                                    <ImageIcon className="text-blue-400/30" size={32} />
                                </div>
                                <div className="flex flex-col gap-2 w-full">
                                    <button 
                                        onClick={() => imgInputRef.current?.click()}
                                        className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-2"
                                    >
                                        <Upload size={14} /> Upload Photo
                                    </button>
                                    <button 
                                        onClick={() => setImagePickerOpen(true)}
                                        className="w-full py-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-[11px] font-bold text-blue-400 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Library size={14} /> From Library
                                    </button>
                                </div>
                                <p className="text-[9px] text-white/20 uppercase tracking-tighter text-center">PNG, JPG up to 10MB</p>
                            </div>
                        )}
                    </div>
                    <input ref={imgInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>

                {/* Audio Selection */}
                <div className="rounded-2xl border border-white/10 bg-[#111] p-6 space-y-4 shadow-xl ring-1 ring-white/5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Reference Audio</label>
                    </div>

                    <div 
                        className={`group relative aspect-square rounded-xl overflow-hidden border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3
                            ${audioUrl ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}
                        `}
                    >
                        {audioUrl ? (
                            <div className="flex flex-col items-center gap-4 px-6 w-full text-center">
                                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                                    <Music className="text-blue-400" size={32} />
                                </div>
                                <div className="w-full">
                                    <p className="text-[11px] font-bold text-blue-400 truncate max-w-full">
                                        {audioFileName || "Audio selected"}
                                    </p>
                                    <button 
                                        onClick={() => { setAudioUrl(null); setAudioFileName(null); }}
                                        className="mt-4 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/60 transition-all flex items-center justify-center gap-2 mx-auto"
                                    >
                                        <X size={12} /> Remove Audio
                                    </button>
                                </div>
                                <audio controls src={audioUrl} className="h-8 w-full mt-4" />
                            </div>
                        ) : uploadingAudio ? (
                            <div className="flex flex-col items-center gap-4 animate-pulse text-blue-400/50">
                                <Loader2 className="animate-spin" size={32} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Uploading...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-6 p-4">
                                <div className="w-16 h-16 rounded-full bg-blue-500/5 flex items-center justify-center">
                                    <Music className="text-blue-400/30" size={32} />
                                </div>
                                <div className="flex flex-col gap-2 w-full">
                                    <button 
                                        onClick={() => audioInputRef.current?.click()}
                                        className="w-full py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-white transition-all flex items-center justify-center gap-2"
                                    >
                                        <Upload size={14} /> Upload Audio
                                    </button>
                                    <button 
                                        onClick={() => setAudioPickerOpen(true)}
                                        className="w-full py-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-[11px] font-bold text-blue-400 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Library size={14} /> From Library
                                    </button>
                                </div>
                                <p className="text-[9px] text-white/20 uppercase tracking-tighter text-center">MP3, WAV up to 20MB</p>
                            </div>
                        )}
                    </div>
                    <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                </div>
            </div>

            <div className="space-y-6">
                {/* Advanced Controls */}
                <div className="rounded-2xl border border-white/10 bg-[#111] p-6 space-y-4 shadow-xl ring-1 ring-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">Facial Expression</label>
                            <div className="flex flex-wrap gap-2 bg-zinc-900 border border-white/5 p-1 rounded-xl">
                                {(["default", "happy"] as const).map(exp => (
                                    <button
                                        key={exp}
                                        onClick={() => setExpression(exp)}
                                        className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${expression === exp ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                                    >
                                        {exp}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wider block mb-2">Talking Style</label>
                            <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl">
                                <button
                                    onClick={() => setTalkingStyle("stable")}
                                    className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${talkingStyle === "stable" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                                >Stable</button>
                                <button
                                    onClick={() => setTalkingStyle("expressive")}
                                    className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${talkingStyle === "expressive" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                                >Expressive</button>
                            </div>
                        </div>
                    </div>
                </div>

                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

                <button
                    onClick={handleGenerate}
                    disabled={generating || !hasCredits || !imageUrl || !audioUrl}
                    className="w-full py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                >
                    {generating ? (
                        <><Loader2 size={18} className="animate-spin" /> Animating Avatar… (this can take ~2-4 min)</>
                    ) : (
                        <><Wand2 size={18} /> Generate Lip Sync ({isAdmin ? "∞" : COST} Cr)</>
                    )}
                </button>
            </div>

            {/* Result */}
            {videoUrl && (
                <div className="rounded-2xl border border-blue-400/20 bg-blue-500/5 p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                            <Wand2 size={16} className="text-blue-400" /> Generated Lip Sync
                        </span>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 font-bold text-xs transition-all"
                        >
                            <Download size={14} /> Download
                        </button>
                    </div>
                    <video 
                        ref={videoRef}
                        controls 
                        src={proxyVideoUrl(videoUrl)} 
                        className="w-full rounded-xl shadow-2xl" 
                        playsInline
                        // @ts-ignore
                        webkit-playsinline="true"
                    />
                </div>
            )}

            <LibraryImagePickerModal
                isOpen={imagePickerOpen}
                onClose={() => setImagePickerOpen(false)}
                onSelect={(url) => {
                    setImageUrl(url);
                    setError(null);
                }}
            />

            <LibraryAudioPickerModal
                isOpen={audioPickerOpen}
                onClose={() => setAudioPickerOpen(false)}
                onSelect={(url) => {
                    setAudioUrl(url);
                    setAudioFileName("From Library");
                    setError(null);
                }}
            />
        </div>
    );
}
