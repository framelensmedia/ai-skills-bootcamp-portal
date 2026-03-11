"use client";

import { useState } from "react";
import { Loader2, Clapperboard, RefreshCw, Wand2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import LibraryImagePickerModal from "@/components/LibraryImagePickerModal";
import LibraryVideoPickerModal from "@/components/LibraryVideoPickerModal";
import { compressImage } from "@/lib/compressImage";
import { waitForVideoGeneration } from "@/lib/waitForVideoGeneration";

interface KlingMotionTabProps {
    isAdmin: boolean;
    hasCredits: boolean;
    userCredits: number | null;
    creditError: string | null;
    COST: number;
    onCreditsUpdate: (credits: number) => void;
}

export default function KlingMotionTab({ isAdmin, hasCredits, userCredits, creditError, COST, onCreditsUpdate }: KlingMotionTabProps) {
    const supabase = createSupabaseBrowserClient();

    const [prompt, setPrompt] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [videoPreview, setVideoPreview] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [libraryImageModalOpen, setLibraryImageModalOpen] = useState(false);
    const [libraryVideoModalOpen, setLibraryVideoModalOpen] = useState(false);
    const [videoResult, setVideoResult] = useState<string | null>(null);

    const uploadToStorage = async (blobUrl: string, type: 'image' | 'video'): Promise<string> => {
        const d = await fetch(blobUrl);
        const blob = await d.blob();

        let fileToUpload: File | Blob = blob;
        let filename = `kling_upload_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`;

        if (type === 'image') {
            const file = new File([blob], filename, { type: blob.type });
            fileToUpload = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
            filename = (fileToUpload as File).name;
        }

        const signRes = await fetch("/api/sign-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, fileType: fileToUpload.type || (type === 'image' ? 'image/jpeg' : 'video/mp4') })
        });

        if (!signRes.ok) throw new Error("Failed to get upload signature");
        const { signedUrl, publicUrl } = await signRes.json();

        const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            body: fileToUpload,
            headers: { "Content-Type": fileToUpload.type || (type === 'image' ? 'image/jpeg' : 'video/mp4') }
        });

        if (!uploadRes.ok) throw new Error(`Failed to upload ${type} to storage`);
        return publicUrl;
    };

    const handleGenerate = async () => {
        if (!imagePreview || !videoPreview) {
            setError("Kling v3 Motion Control requires both a Character Image and a Motion Reference Video.");
            return;
        }

        setError(null);
        setGenerating(true);
        setVideoResult(null);

        try {
            let finalImageUrl = imagePreview;
            let finalVideoUrl = videoPreview;

            if (imagePreview.startsWith("blob:")) {
                finalImageUrl = await uploadToStorage(imagePreview, 'image');
            }
            if (videoPreview.startsWith("blob:")) {
                finalVideoUrl = await uploadToStorage(videoPreview, 'video');
            }

            // Call the Kling API
            const res = await fetch("/api/kling-motion-control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrl: finalImageUrl,
                    videoUrl: finalVideoUrl,
                    prompt: prompt.trim() || undefined
                })
            });

            const data = await res.json();

            if (res.status === 202 && data?.status === "pending" && data?.generationId) {
                setError("Kling is processing your request. This may take a few minutes. Check your Library later!");
                const finalUrl = await waitForVideoGeneration(data.generationId);
                setError(null);
                if (finalUrl) {
                    setVideoResult(finalUrl);
                    if (!isAdmin && data.remainingCredits !== undefined) {
                        onCreditsUpdate(data.remainingCredits);
                    }
                } else {
                    throw new Error("Generation is still processing in the background. Please check your Library in a few minutes.");
                }
                return;
            }

            if (!res.ok) throw new Error(data.error || "Failed to animate image with Kling");

            if (data.videoUrl) {
                setVideoResult(data.videoUrl);

                if (!isAdmin && userCredits !== null) {
                    onCreditsUpdate(userCredits - COST);
                }
            } else {
                throw new Error("No video URL returned from Kling");
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || "A Kling generation error occurred");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6 order-2 lg:order-1">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Wand2 className="w-5 h-5 text-purple-400" /> Kling v3 Motion Control
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1 italic">
                            Transfer exact human motion from a video onto any character image.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Character Image */}
                    <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5 space-y-4">
                        <div className="text-sm font-bold text-foreground">1. Character Image</div>
                        <p className="text-xs text-muted-foreground">The person or character.</p>

                        {imagePreview ? (
                            <div className="relative aspect-[4/5] w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-white/10 group">
                                <img src={imagePreview} alt="Selected" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <button
                                        onClick={() => setImagePreview(null)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <label className="w-full py-3 bg-[#111] hover:bg-[#222] border border-white/10 rounded-xl text-sm font-bold text-white transition flex justify-center items-center gap-2 cursor-pointer">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setImagePreview(URL.createObjectURL(e.target.files[0]));
                                            }
                                        }}
                                    />
                                    Upload Image
                                </label>
                                <button
                                    onClick={() => setLibraryImageModalOpen(true)}
                                    className="w-full py-3 bg-[#111] hover:bg-[#222] border border-white/10 rounded-xl text-sm font-bold text-white transition flex justify-center items-center gap-2"
                                >
                                    <Clapperboard size={16} /> Library
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Motion Reference Video */}
                    <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5 space-y-4">
                        <div className="text-sm font-bold text-foreground">2. Motion Reference</div>
                        <p className="text-xs text-muted-foreground">The movement to copy.</p>

                        {videoPreview ? (
                            <div className="relative aspect-[4/5] w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-white/10 group">
                                <video src={videoPreview} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <button
                                        onClick={() => setVideoPreview(null)}
                                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <label className="w-full py-3 bg-[#111] hover:bg-[#222] border border-white/10 rounded-xl text-sm font-bold text-white transition flex justify-center items-center gap-2 cursor-pointer">
                                    <input
                                        type="file"
                                        accept="video/mp4,video/webm,video/quicktime"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setVideoPreview(URL.createObjectURL(e.target.files[0]));
                                            }
                                        }}
                                    />
                                    Upload Video
                                </label>
                                <button
                                    onClick={() => setLibraryVideoModalOpen(true)}
                                    className="w-full py-3 bg-[#111] hover:bg-[#222] border border-white/10 rounded-xl text-sm font-bold text-white transition flex justify-center items-center gap-2"
                                >
                                    <Clapperboard size={16} /> Library
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5 space-y-4">
                    <div className="text-sm font-bold text-foreground">3. Motion Instructions (Optional)</div>
                    <p className="text-xs text-muted-foreground">Add details about camera movement or specific stylistic adjustments.</p>

                    <textarea
                        className="w-full h-24 bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Optional prompt..."
                    />
                </div>

                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                        {error}
                    </div>
                )}
                {creditError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                        {creditError}
                    </div>
                )}

                <button
                    onClick={handleGenerate}
                    disabled={generating || (!hasCredits && !isAdmin)}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {generating ? (
                        <>
                            <RefreshCw className="animate-spin w-5 h-5" />
                            Kling is working...
                        </>
                    ) : (
                        <>
                            <Wand2 className="w-5 h-5" />
                            Transfer Motion (-{COST} Credits)
                        </>
                    )}
                </button>
            </div>

            <div className="lg:col-span-7 order-1 lg:order-2">
                <div className="sticky top-24">
                    <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden border border-border shadow-2xl relative flex items-center justify-center group">
                        {generating && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                                <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
                                <p className="text-purple-400 font-bold tracking-widest uppercase">Generating Motion...</p>
                                <p className="text-white/50 text-sm mt-2">Kling can take a few minutes.</p>
                            </div>
                        )}

                        {videoResult ? (
                            <video
                                src={videoResult}
                                className="w-full h-full object-cover"
                                autoPlay
                                loop
                                controls
                            />
                        ) : (
                            <div className="text-center p-8">
                                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Wand2 size={32} className="text-white/20" />
                                </div>
                                <h3 className="text-xl font-bold text-white/40">Kling Motion Output</h3>
                                <p className="text-sm text-white/30 mt-2 max-w-sm mx-auto">Upload a character and motion reference to see the result.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {libraryImageModalOpen && (
                <LibraryImagePickerModal
                    isOpen={libraryImageModalOpen}
                    onClose={() => setLibraryImageModalOpen(false)}
                    onSelect={(url) => {
                        setImagePreview(url);
                        setLibraryImageModalOpen(false);
                    }}
                />
            )}

            {libraryVideoModalOpen && (
                <LibraryVideoPickerModal
                    isOpen={libraryVideoModalOpen}
                    onClose={() => setLibraryVideoModalOpen(false)}
                    onSelect={(url) => {
                        setVideoPreview(url);
                        setLibraryVideoModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
