"use client";

import { useState } from "react";
import { Loader2, Clapperboard, RefreshCw, AudioLines } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import LibraryImagePickerModal from "@/components/LibraryImagePickerModal";
import LibraryAudioPickerModal from "@/components/LibraryAudioPickerModal";
import { compressImage } from "@/lib/compressImage";
import { waitForVideoGeneration } from "@/lib/waitForVideoGeneration";

interface AudioVideoTabProps {
    isAdmin: boolean;
    hasCredits: boolean;
    userCredits: number | null;
    creditError: string | null;
    COST: number;
    onCreditsUpdate: (credits: number) => void;
}

export default function AudioVideoTab({ isAdmin, hasCredits, userCredits, creditError, COST, onCreditsUpdate }: AudioVideoTabProps) {
    const supabase = createSupabaseBrowserClient();

    const [prompt, setPrompt] = useState("");
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [audioFile, setAudioFile] = useState<string | null>(null);
    const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [libraryImageModalOpen, setLibraryImageModalOpen] = useState(false);
    const [libraryAudioModalOpen, setLibraryAudioModalOpen] = useState(false);
    const [videoResult, setVideoResult] = useState<string | null>(null);

    const uploadToStorage = async (blobUrl: string, type: 'image' | 'audio'): Promise<string> => {
        const d = await fetch(blobUrl);
        const blob = await d.blob();

        let fileToUpload: File | Blob = blob;
        let filename = `audiovideo_upload_${Date.now()}.${type === 'image' ? 'jpg' : 'mp3'}`;

        if (type === 'image') {
            const file = new File([blob], filename, { type: blob.type });
            fileToUpload = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
            filename = (fileToUpload as File).name;
        }

        const signRes = await fetch("/api/sign-upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename, fileType: fileToUpload.type || (type === 'image' ? 'image/jpeg' : 'audio/mpeg') })
        });

        if (!signRes.ok) throw new Error("Failed to get upload signature");
        const { signedUrl, publicUrl } = await signRes.json();

        const uploadRes = await fetch(signedUrl, {
            method: "PUT",
            body: fileToUpload,
            headers: { "Content-Type": fileToUpload.type || (type === 'image' ? 'image/jpeg' : 'audio/mpeg') }
        });

        if (!uploadRes.ok) throw new Error(`Failed to upload ${type} to storage`);
        return publicUrl;
    };

    const handleGenerate = async () => {
        if (!imagePreview || !audioFile) {
            setError("Please provide both a Source Image and an Audio track.");
            return;
        }

        setError(null);
        setGenerating(true);
        setVideoResult(null);

        try {
            let finalImageUrl = imagePreview;
            let finalAudioUrl = audioFile;

            if (imagePreview.startsWith("blob:")) {
                finalImageUrl = await uploadToStorage(imagePreview, 'image');
            }
            if (audioFile.startsWith("blob:")) {
                finalAudioUrl = await uploadToStorage(audioFile, 'audio');
            }

            // Call the LTX Audio-to-Video API
            const res = await fetch("/api/ltx-audio-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrl: finalImageUrl,
                    audioUrl: finalAudioUrl,
                    prompt: prompt.trim() || undefined,
                    aspectRatio
                })
            });

            const data = await res.json();

            // Handle async pending (LTX Audio-to-Video can take 5+ mins - returns 202)
            if (res.status === 202 && data?.status === "pending" && data?.generationId) {
                setError("Audio-to-Video generation typically takes 3-5 minutes. Feel free to wait here or check your Library later!");
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

            if (!res.ok) throw new Error(data.error || "Failed to animate image with audio");

            if (data.videoUrl) {
                setVideoResult(data.videoUrl);

                // Deduct credits locally if not admin to keep UI in sync
                if (!isAdmin && userCredits !== null) {
                    onCreditsUpdate(userCredits - COST);
                }
            } else {
                throw new Error("No video URL returned");
            }

        } catch (err: any) {
            console.error(err);
            setError(err.message || "An animation error occurred");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN: Controls */}
            <div className="lg:col-span-5 space-y-6 order-2 lg:order-1">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">Audio-to-Video</h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            Powered by LTX 2.3. Bring static images to life perfectly synchronized with audio.
                        </p>
                    </div>
                    <div className="text-xs font-bold text-primary uppercase tracking-wider">Video Model</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    {/* Source Image */}
                    <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5 space-y-4">
                        <div className="text-sm font-bold text-foreground">1. Source Image</div>
                        <p className="text-xs text-muted-foreground">The subject or scene.</p>

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

                    {/* Audio Track */}
                    <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5 space-y-4">
                        <div className="text-sm font-bold text-foreground">2. Audio Track</div>
                        <p className="text-xs text-muted-foreground">The audio to sync.</p>

                        {audioFile ? (
                            <div className="relative aspect-[4/5] w-full max-w-sm mx-auto rounded-xl overflow-hidden border border-white/10 group bg-[#111] flex flex-col items-center justify-center text-center p-4">
                                <AudioLines size={32} className="text-primary mb-2" />
                                <div className="text-xs text-white/50 break-all w-full line-clamp-2">Audio Selected</div>
                                <audio src={audioFile} controls className="w-full mt-4 h-8" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <button
                                        onClick={() => setAudioFile(null)}
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
                                        accept="audio/mp3,audio/wav,audio/mpeg"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setAudioFile(URL.createObjectURL(e.target.files[0]));
                                            }
                                        }}
                                    />
                                    Upload Audio
                                </label>
                                <button
                                    onClick={() => setLibraryAudioModalOpen(true)}
                                    className="w-full py-3 bg-[#111] hover:bg-[#222] border border-white/10 rounded-xl text-sm font-bold text-white transition flex justify-center items-center gap-2"
                                >
                                    <AudioLines size={16} /> Library
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5 space-y-4">
                    <div className="text-sm font-bold text-foreground">3. Output Settings</div>
                    <p className="text-xs text-muted-foreground">Select the dimensions for your generated video so that it matches your uploaded image.</p>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        {(["16:9", "9:16", "1:1"] as const).map((ratio) => (
                            <button
                                key={ratio}
                                onClick={() => setAspectRatio(ratio)}
                                className={`py-3 rounded-xl border text-sm font-bold transition-all ${aspectRatio === ratio
                                    ? "bg-primary text-black border-primary"
                                    : "bg-background border-border text-foreground hover:border-primary/50"
                                    }`}
                            >
                                {ratio}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="rounded-3xl border border-border bg-card p-6 backdrop-blur-2xl shadow-sm ring-1 ring-border/5 space-y-4">
                    <div className="text-sm font-bold text-foreground">4. Camera Motion & Context (Optional)</div>
                    <p className="text-xs text-muted-foreground">Describe how you want the camera to move (e.g. "Slow pan left") or give the model context of what is happening in the scene.</p>

                    <textarea
                        className="w-full h-24 bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Optional motion prompt..."
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
                    className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {generating ? (
                        <>
                            <RefreshCw className="animate-spin w-5 h-5" />
                            Animating Video...
                        </>
                    ) : (
                        <>
                            <Clapperboard className="w-5 h-5" />
                            Generate Video (-{COST} Credits)
                        </>
                    )}
                </button>
            </div>

            {/* RIGHT COLUMN: Output */}
            <div className="lg:col-span-7 order-1 lg:order-2">
                <div className="sticky top-24">
                    <div className="w-full aspect-[4/5] bg-black rounded-3xl overflow-hidden border border-border shadow-2xl relative flex items-center justify-center group">

                        {generating && (
                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                <p className="text-primary font-bold tracking-widest uppercase">Syncing Audio...</p>
                                <p className="text-white/50 text-sm mt-2">This usually takes about 30 seconds.</p>
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
                                    <Clapperboard size={32} className="text-white/20" />
                                </div>
                                <h3 className="text-xl font-bold text-white/40">Audio-to-Video Output</h3>
                                <p className="text-sm text-white/30 mt-2 max-w-sm mx-auto">Upload an image and an audio track to let LTX animate the scene to match the sound.</p>
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

            {libraryAudioModalOpen && (
                <LibraryAudioPickerModal
                    isOpen={libraryAudioModalOpen}
                    onClose={() => setLibraryAudioModalOpen(false)}
                    onSelect={(url: string) => {
                        setAudioFile(url);
                        setLibraryAudioModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
