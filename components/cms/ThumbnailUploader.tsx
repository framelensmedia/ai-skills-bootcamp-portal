"use client";

import { useState, useRef, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Upload, X, Loader2, Image as ImageIcon } from "lucide-react";
import Image from "next/image";
import { compressImage } from "@/lib/compressImage";

type Props = {
    currentUrl?: string | null;
    onUpload: (url: string) => void;
    bucket?: string;
    folder?: string;
    accept?: string;
    maxSizeMB?: number;
};

export default function ThumbnailUploader({
    currentUrl,
    onUpload,
    bucket = "bootcamp-assets",
    folder = "thumbnails",
    accept = "image/*",
    maxSizeMB = 5,
}: Props) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const inputRef = useRef<HTMLInputElement>(null);

    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size
        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`File too large. Max ${maxSizeMB}MB.`);
            return;
        }

        // Validate file type
        if (!file.type.startsWith("image/")) {
            setError("Please select an image file.");
            return;
        }

        setError(null);
        setUploading(true);

        try {
            // Create unique filename
            const ext = "webp"; // We compress to webp
            const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

            // Compress
            let fileToUpload = file;
            try {
                fileToUpload = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
            } catch (e) {
                console.warn("Thumbnail compression failed", e);
            }

            // Upload to Supabase Storage
            const { data, error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filename, fileToUpload, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: "image/webp"
                });

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(bucket)
                .getPublicUrl(data.path);

            const publicUrl = urlData.publicUrl;

            setPreviewUrl(publicUrl);
            onUpload(publicUrl);

        } catch (err: any) {
            console.error("Upload error:", err);
            setError(err.message || "Failed to upload image");
        } finally {
            setUploading(false);
        }
    }

    function handleClear() {
        setPreviewUrl(null);
        onUpload("");
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    }

    return (
        <div className="space-y-2">
            {/* Preview or Upload Area */}
            {previewUrl ? (
                <div className="relative group">
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-white/10">
                        <Image
                            src={previewUrl}
                            alt="Thumbnail preview"
                            fill
                            className="object-cover"
                            unoptimized
                        />
                    </div>

                    {/* Overlay with actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition"
                        >
                            <Upload size={16} />
                            Replace
                        </button>
                        <button
                            type="button"
                            onClick={handleClear}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition"
                        >
                            <X size={16} />
                            Remove
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="w-full aspect-video rounded-xl border-2 border-dashed border-white/20 bg-zinc-900/50 flex flex-col items-center justify-center gap-3 hover:border-[#B7FF00]/50 hover:bg-zinc-900 transition disabled:opacity-50"
                >
                    {uploading ? (
                        <>
                            <Loader2 size={32} className="text-[#B7FF00] animate-spin" />
                            <span className="text-sm text-white/60">Uploading...</span>
                        </>
                    ) : (
                        <>
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                                <ImageIcon size={24} className="text-white/40" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-white/80">Click to upload thumbnail</p>
                                <p className="text-xs text-white/40 mt-1">PNG, JPG, WebP • Max {maxSizeMB}MB</p>
                            </div>
                        </>
                    )}
                </button>
            )}

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Error message */}
            {error && (
                <p className="text-xs text-red-400">{error}</p>
            )}

            {/* Manual URL fallback */}
            <details className="group">
                <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                    Or paste image URL
                </summary>
                <div className="mt-2">
                    <input
                        type="url"
                        value={previewUrl || ""}
                        onChange={(e) => {
                            setPreviewUrl(e.target.value);
                            onUpload(e.target.value);
                        }}
                        placeholder="https://..."
                        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                    />
                </div>
            </details>
        </div>
    );
}
