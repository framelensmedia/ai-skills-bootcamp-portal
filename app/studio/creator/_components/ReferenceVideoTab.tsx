"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Loader2, Download, Upload, X, Wand2, Plus, Library } from "lucide-react";
import LibraryImagePickerModal from "@/components/LibraryImagePickerModal";

type ReferenceVideoTabProps = {
    userCredits: number | null;
    isAdmin: boolean;
    onCreditsUsed: (amount: number) => void;
};

const COST = 30;

export default function ReferenceVideoTab({ userCredits, isAdmin, onCreditsUsed }: ReferenceVideoTabProps) {
    const [prompt, setPrompt] = useState("");
    const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
    const [referenceImages, setReferenceImages] = useState<{ url: string; fromLibrary: boolean }[]>([]);
    const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
    const [stylePreset, setStylePreset] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const hasCredits = (userCredits ?? 0) >= COST || isAdmin;
    const canAddMore = referenceImages.length < 3;

    const STYLE_PRESETS = [
        { id: "cinematic", label: "Cinematic", icon: "🎬", prompt: "Shot on RED Weapon 8K with Panavision Primo 70mm lens. Cinematic lighting, color graded." },
        { id: "commercial", label: "TV Ad", icon: "📺", prompt: "Shot on ARRI Alexa Mini with Zeiss Master Prime 50mm. High key lighting, crisp, clean, premium advertisement look." },
        { id: "documentary", label: "Docu", icon: "📹", prompt: "Shot on Canon 5D Mk IV with Sigma 24-70mm f/2.8 lens. Natural lighting, handheld feel, authentic texture." },
        { id: "cartoon", label: "Cartoon", icon: "🎨", prompt: "3D Animation style by Pixar. Vibrant colors, expressive lighting, soft shading, cute characters." }
    ];

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        const newImages: { url: string; fromLibrary: boolean }[] = [];
        let errorMsg: string | null = null;

        for (const file of files) {
            if (referenceImages.length + newImages.length >= 3) break;
            
            if (file.size > 10 * 1024 * 1024) {
                errorMsg = "Some images were too large (max 10MB)";
                continue;
            }

            const url = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
            newImages.push({ url, fromLibrary: false });
        }

        if (newImages.length > 0) {
            setReferenceImages(prev => [...prev, ...newImages]);
        }
        setError(errorMsg);
        e.target.value = "";
    }

    function removeImage(index: number) {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    }

    async function handleGenerate() {
        if (!prompt.trim()) { setError("Please enter a prompt."); return; }
        if (!referenceImages.length) { setError("Please add at least one reference image."); return; }
        if (!hasCredits) { setError(`You need at least ${COST} credits.`); return; }

        setGenerating(true);
        setError(null);
        setVideoUrl(null);

        try {
            const res = await fetch("/api/reference-to-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    referenceImages: referenceImages.map(img => img.url),
                    aspectRatio,
                    stylePreset,
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

    function handleDownload() {
        if (!videoUrl) return;
        const a = document.createElement("a");
        a.href = videoUrl;
        a.download = `reference-video-${Date.now()}.mp4`;
        a.click();
    }

    return (
        <div className="w-full max-w-3xl mx-auto space-y-8 py-4">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                        <Wand2 className="text-violet-400" size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Magic Video</h2>
                        <p className="text-xs text-white/40">Generate a video guided by reference images · {COST} credits</p>
                    </div>
                </div>
                {/* Aspect Ratio */}
                <div className="flex bg-zinc-900 border border-white/5 p-1 rounded-xl self-start w-full md:w-auto">
                    <button
                        onClick={() => setAspectRatio("16:9")}
                        className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${aspectRatio === "16:9" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                    >Landscape</button>
                    <button
                        onClick={() => setAspectRatio("9:16")}
                        className={`flex-1 md:flex-none px-4 py-1.5 text-[10px] font-bold uppercase rounded-lg transition-all ${aspectRatio === "9:16" ? "bg-white/10 text-white" : "text-white/40 hover:text-white"}`}
                    >Portrait</button>
                </div>
            </div>

            {/* Reference Images */}
            <div className="rounded-2xl border border-white/10 bg-[#111] p-6 space-y-5 shadow-xl ring-1 ring-white/5">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Reference Images</label>
                        <p className="text-[10px] text-white/30 mt-0.5">Add up to 3 images — characters, scenes, or objects</p>
                    </div>
                    {canAddMore && (
                        <div className="flex flex-wrap items-center gap-2 justify-end">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white/60 transition-all border border-white/5"
                            >
                                <Upload size={12} /> Upload
                            </button>
                            <button
                                onClick={() => setLibraryPickerOpen(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-[10px] font-bold text-violet-400 transition-all border border-violet-500/10"
                            >
                                <Library size={12} /> From Library
                            </button>
                        </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                </div>

                {/* Image Slots */}
                <div className="grid grid-cols-3 gap-3">
                    {referenceImages.map((img, i) => (
                        <div key={i} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5">
                            <Image src={img.url} alt={`Reference ${i + 1}`} fill className="object-cover" unoptimized />
                            <button
                                onClick={() => removeImage(i)}
                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white/60 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            >
                                <X size={12} />
                            </button>
                            {img.fromLibrary && (
                                <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-violet-500 text-[7px] font-bold text-white uppercase">Library</div>
                            )}
                            <div className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-[9px] font-bold text-white/70">{i + 1}</div>
                        </div>
                    ))}
                    {canAddMore && (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-violet-400/30 transition-all flex flex-col items-center justify-center gap-2 text-white/30 hover:text-violet-400"
                        >
                            <Plus size={20} />
                            <span className="text-[9px] font-bold uppercase">Add Image</span>
                        </button>
                    )}
                    {/* Empty placeholder slots */}
                    {Array.from({ length: Math.max(0, 2 - referenceImages.length) }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square rounded-xl border border-white/5 bg-white/[0.01]" />
                    ))}
                </div>

                {/* Style Presets */}
                <div className="space-y-3">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Style Preset</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {STYLE_PRESETS.map((style) => (
                            <button
                                key={style.id}
                                onClick={() => setStylePreset(stylePreset === style.id ? null : style.id)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${stylePreset === style.id
                                    ? "bg-violet-500/20 border-violet-500/50 text-white"
                                    : "bg-white/5 border-white/5 text-white/50 hover:border-white/10 hover:bg-white/[0.07]"
                                    }`}
                            >
                                <span className="text-base">{style.icon}</span>
                                {style.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-white/50 uppercase tracking-wider block">Prompt</label>
                    <textarea
                        rows={3}
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="Describe what happens in the video — actions, environment, mood..."
                        className="w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-violet-400/50 focus:ring-1 focus:ring-violet-400/20 resize-none leading-relaxed"
                    />
                </div>

                {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}

                <button
                    onClick={handleGenerate}
                    disabled={generating || !hasCredits || !prompt.trim() || !referenceImages.length}
                    className="w-full py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
                >
                    {generating ? (
                        <><Loader2 size={18} className="animate-spin" /> Generating Video… (this can take ~2-3 min)</>
                    ) : (
                        <><Wand2 size={18} /> Generate Video ({isAdmin ? "∞" : COST} Cr)</>
                    )}
                </button>
            </div>

            {/* Result */}
            {videoUrl && (
                <div className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-6 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white flex items-center gap-2">
                            <Wand2 size={16} className="text-violet-400" /> Generated Video
                        </span>
                        <button
                            onClick={handleDownload}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/70 font-bold text-xs transition-all"
                        >
                            <Download size={14} /> Download
                        </button>
                    </div>
                    <video controls src={videoUrl} className="w-full rounded-xl" />
                </div>
            )}

            <LibraryImagePickerModal
                isOpen={libraryPickerOpen}
                onClose={() => setLibraryPickerOpen(false)}
                onSelect={(url) => {
                    if (canAddMore) {
                        setReferenceImages(prev => [...prev, { url, fromLibrary: true }]);
                        setError(null);
                    }
                }}
            />
        </div>
    );
}
