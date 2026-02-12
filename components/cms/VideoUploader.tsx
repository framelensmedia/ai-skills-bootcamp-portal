"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2, Video as VideoIcon, CheckCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { toast } from "sonner";

type Props = {
    onUpload: (url: string, duration?: number) => void;
    currentUrl?: string;
};

export default function VideoUploader({ onUpload, currentUrl }: Props) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createSupabaseBrowserClient();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        console.log("File selected");
        const file = e.target.files?.[0];
        if (!file) return;

        console.log("File:", file.name, file.type, file.size);

        // Validation
        const validTypes = ["video/mp4", "video/webm", "video/quicktime"]; // .mp4, .webm, .mov
        if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|webm|mov)$/i)) {
            setError("Please upload a valid video file (MP4, WebM, MOV)");
            return;
        }

        // 50MB limit
        if (file.size > 50 * 1024 * 1024) {
            setError("File is too large. Max size is 50MB.");
            return;
        }

        try {
            setUploading(true);

            // Get video duration with timeout
            const duration = await Promise.race([
                getVideoDuration(file),
                new Promise<number>((r) => setTimeout(() => r(0), 2000))
            ]);

            const fileExt = file.name.split(".").pop();
            const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("bootcamp-videos")
                .upload(filePath, file, {
                    cacheControl: "3600",
                    upsert: false,
                });

            if (uploadError) {
                console.error("Supabase Upload Error:", uploadError);
                if (uploadError.message.includes("Bucket not found")) {
                    throw new Error("Storage bucket not configured. Please run the SQL script.");
                }
                throw uploadError;
            }

            const { data } = supabase.storage
                .from("bootcamp-videos")
                .getPublicUrl(filePath);

            onUpload(data.publicUrl, duration || 0);
            toast.success("Video uploaded successfully");

        } catch (error: any) {
            console.error("Upload failed catch:", error);
            const msg = error.message || "Failed to upload video";
            setError(msg);
            toast.error(msg);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    const getVideoDuration = (file: File): Promise<number> => {
        return new Promise((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.onloadedmetadata = () => {
                window.URL.revokeObjectURL(video.src);
                resolve(Math.round(video.duration));
            };
            video.onerror = () => {
                resolve(0);
            };
            video.src = URL.createObjectURL(file);
        });
    };

    return (
        <div className="w-full">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept=".mp4,.webm,.mov"
                className="hidden"
            />

            {!currentUrl ? (
                <div className="space-y-2">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={`group relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed transition
                            ${error ? "border-red-500/50 bg-red-500/5" : "border-white/20 bg-zinc-900/50 hover:border-[#B7FF00]/50 hover:bg-zinc-900"}
                            p-8`}
                    >
                        {uploading ? (
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="animate-spin text-[#B7FF00]" size={24} />
                                <div className="text-center">
                                    <p className="text-sm font-medium text-white">Uploading...</p>
                                    <p className="text-xs text-white/50">Please wait, do not close.</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mb-3 rounded-full bg-white/5 p-3 transition group-hover:bg-[#B7FF00]/10 group-hover:text-[#B7FF00]">
                                    <Upload size={24} />
                                </div>
                                <p className="mb-1 text-sm font-medium text-white/90">Click to upload video</p>
                                <p className="text-xs text-white/40">MP4, WebM, MOV (Max 50MB)</p>
                            </>
                        )}
                    </button>

                    {error && (
                        <div className="rounded-lg bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
                            <X size={14} className="shrink-0" />
                            {error}
                        </div>
                    )}
                </div>
            ) : (
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900 group">
                    {/* Video Player Preview */}
                    <div className="relative aspect-video w-full bg-black">
                        <video
                            src={currentUrl}
                            controls
                            className="w-full h-full object-contain"
                            preload="metadata"
                        />
                    </div>

                    {/* Controls Overlay */}
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a
                            href={currentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg bg-black/60 text-white/80 hover:bg-black hover:text-white backdrop-blur-sm"
                            title="Open in new tab"
                        >
                            <VideoIcon size={14} />
                        </a>
                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to remove this video?")) {
                                    onUpload("", 0);
                                }
                            }}
                            className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500 backdrop-blur-sm"
                            title="Remove video"
                        >
                            <X size={14} />
                        </button>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-2 text-xs text-white/40 bg-zinc-900 border-t border-white/5 truncate px-3">
                        {currentUrl}
                    </div>
                </div>
            )}
        </div>
    );
}
