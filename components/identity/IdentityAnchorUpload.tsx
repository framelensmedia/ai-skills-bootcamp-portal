"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Upload, X, Loader2, User, CheckCircle, Image as ImageIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { toast } from "sonner";

type Props = {
    onUploadComplete?: (identity: any) => void;
};

export default function IdentityAnchorUpload({ onUploadComplete }: Props) {
    const [name, setName] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const supabase = createSupabaseBrowserClient();

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validation
        if (!selectedFile.type.startsWith("image/")) {
            toast.error("Please upload an image file (JPEG, PNG, WebP)");
            return;
        }

        if (selectedFile.size > 10 * 1024 * 1024) { // 10MB
            toast.error("File is too large. Max size is 10MB.");
            return;
        }

        setFile(selectedFile);
        const objectUrl = URL.createObjectURL(selectedFile);
        setPreviewUrl(objectUrl);

        // Auto-fill name if empty
        if (!name) {
            // Remove extension and capitalize
            const baseName = selectedFile.name.split(".")[0];
            setName(baseName.charAt(0).toUpperCase() + baseName.slice(1).replace(/[-_]/g, " "));
        }
    };

    const handleClear = () => {
        setFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUpload = async () => {
        if (!file || !name) return;

        try {
            setUploading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Unauthorized");

            // 1. Upload Image
            const fileExt = file.name.split(".").pop();
            const fileName = `${crypto.randomUUID()}.${fileExt}`;
            const filePath = `identities/${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("assets") // Using unified assets bucket? Or specific identities bucket?
                // Migration said "assets table" but buckets might be different.
                // Let's assume a bucket named "identities" exists or use "assets".
                // I'll use "identities" as implied by structure, or check if it exists.
                // Actually, let's use "assets" bucket with "identities/" folder if possible?
                // Or "user-content"?
                // Let's try "identities" bucket first. If it fails, I'll need to create it.
                .from("identities")
                .upload(filePath, file);

            if (uploadError) {
                // If bucket doesn't exist, maybe fallback or user needs to create it.
                if (uploadError.message.includes("Bucket not found")) {
                    throw new Error("Storage bucket 'identities' not found. Please create it in Supabase.");
                }
                throw uploadError;
            }

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from("identities")
                .getPublicUrl(filePath);

            // 3. Insert Record
            const { data: identity, error: dbError } = await supabase
                .from("user_identities")
                .insert({
                    user_id: user.id,
                    name: name,
                    identity_type: "human_likeness",
                    ref_image_url: publicUrl,
                    is_active: true,
                    metadata: {
                        original_filename: file.name,
                        file_size: file.size,
                        mime_type: file.type
                    }
                })
                .select()
                .single();

            if (dbError) throw dbError;

            toast.success("Identity Created Successfully!");
            handleClear();
            setName("");
            if (onUploadComplete) onUploadComplete(identity);

        } catch (error: any) {
            console.error("Upload Error:", error);
            toast.error(error.message || "Failed to create identity.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/50 p-6 backdrop-blur-sm">
            <h3 className="mb-4 text-lg font-bold text-white flex items-center gap-2">
                <User className="text-[#B7FF00]" size={20} />
                Create New Identity
            </h3>

            <div className="space-y-4">
                {/* Name Input */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wide">Identity Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Professional Headshot"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#B7FF00]/50 focus:outline-none focus:ring-1 focus:ring-[#B7FF00]/20 transition-all"
                        disabled={uploading}
                    />
                </div>

                {/* Image Upload Area */}
                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/50 uppercase tracking-wide">Reference Image</label>

                    {!previewUrl ? (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="group relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 bg-black/20 p-8 transition hover:border-[#B7FF00]/50 hover:bg-black/40"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                accept="image/*"
                                className="hidden"
                            />
                            <div className="mb-3 rounded-full bg-white/5 p-3 text-white/60 transition group-hover:bg-[#B7FF00]/10 group-hover:text-[#B7FF00]">
                                <Upload size={24} />
                            </div>
                            <p className="mb-1 text-sm font-medium text-white/80">Click to upload face</p>
                            <p className="text-xs text-white/40">Clear, high-quality selfie (Max 10MB)</p>
                        </button>
                    ) : (
                        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-black group">
                            <Image
                                src={previewUrl}
                                alt="Preview"
                                fill
                                className="object-cover transition-opacity group-hover:opacity-50"
                            />

                            {/* Overlay Actions */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={handleClear}
                                    className="rounded-full bg-red-500/20 p-3 text-red-500 hover:bg-red-500 hover:text-white transition backdrop-blur-md"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {uploading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                                    <Loader2 className="animate-spin text-[#B7FF00] mb-2" size={32} />
                                    <p className="text-xs font-medium text-[#B7FF00]">Uploading...</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Submit Action */}
                <button
                    onClick={handleUpload}
                    disabled={!file || !name || uploading}
                    className={`w-full rounded-xl py-3.5 font-bold text-sm transition-all flex items-center justify-center gap-2
                        ${(!file || !name || uploading)
                            ? "bg-white/5 text-white/20 cursor-not-allowed"
                            : "bg-[#B7FF00] text-black hover:bg-[#B7FF00]/90 hover:scale-[1.02] shadow-lg shadow-[#B7FF00]/20"
                        }`}
                >
                    {uploading ? "Creating..." : (
                        <>
                            <CheckCircle size={18} />
                            Create Identity Anchor
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
