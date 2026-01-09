"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileJson, Image as ImageIcon, CheckCircle, XCircle, Loader2, ArrowLeft, X } from "lucide-react";
import Image from "next/image";

type ImportResult = {
    success: boolean;
    message: string;
    created_count?: number;
    draft_ids?: string[];
    errors?: string[];
};

export default function TemplateImportPage() {
    const router = useRouter();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [jsonFile, setJsonFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [dragActive, setDragActive] = useState(false);

    // Handle Image File selection
    const handleImageSelect = (file: File) => {
        if (file && file.type.startsWith("image/")) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    // Handle JSON File selection
    const handleJsonSelect = (file: File) => {
        if (file && (file.type === "application/json" || file.name.endsWith(".json"))) {
            setJsonFile(file);
        }
    };

    // Drag and Drop handlers
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);

            const img = files.find(f => f.type.startsWith("image/"));
            const json = files.find(f => f.type === "application/json" || f.name.endsWith(".json"));

            if (img) handleImageSelect(img);
            if (json) handleJsonSelect(json);
        }
    }, []);

    async function handleImport() {
        if (!imageFile || !jsonFile) {
            setResult({
                success: false,
                message: "Please upload both an image and a JSON file.",
            });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            // Read JSON file
            const jsonText = await jsonFile.text();
            let jsonData;

            try {
                jsonData = JSON.parse(jsonText);
            } catch (e) {
                setResult({
                    success: false,
                    message: "Invalid JSON file. Please check the format.",
                });
                setLoading(false);
                return;
            }

            const formData = new FormData();
            formData.append("image", imageFile);
            formData.append("json", JSON.stringify(jsonData));

            const res = await fetch("/api/admin/templates/import", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                setResult({
                    success: false,
                    message: data.error || "Import failed",
                    errors: data.errors,
                });
            } else {
                setResult(data);
            }
        } catch (error: any) {
            setResult({
                success: false,
                message: error.message || "An unexpected error occurred",
            });
        } finally {
            setLoading(false);
        }
    }

    function handleReset() {
        setImageFile(null);
        setJsonFile(null);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setResult(null);
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-8 text-white">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <button
                        onClick={() => router.back()}
                        className="mb-4 flex items-center gap-2 text-sm text-white/50 hover:text-white transition"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Prompts
                    </button>
                    <h1 className="text-3xl font-bold tracking-tight">Import Templates</h1>
                    <p className="mt-2 text-white/60">
                        Drag and drop your template assets to creates drafts instantly.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Left: Upload Zone */}
                <div className="lg:col-span-2 space-y-6">
                    <div
                        className={`relative flex min-h-[300px] flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all ${dragActive
                                ? "border-[#B7FF00] bg-[#B7FF00]/5 scale-[0.99]"
                                : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-black/30"
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <div className="pointer-events-none mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                            <Upload className={`h-8 w-8 transition ${dragActive ? "text-[#B7FF00]" : "text-white/40"}`} />
                        </div>
                        <h3 className="text-lg font-semibold">Drag & Drop Files Here</h3>
                        <p className="mt-2 text-sm text-white/50 max-w-sm">
                            Drop your template image (PNG/JPG) and JSON configuration file together, or click below to browse.
                        </p>

                        <div className="mt-8 flex gap-3 pointer-events-auto">
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                                className="hidden"
                                id="image-upload"
                            />
                            <label
                                htmlFor="image-upload"
                                className="cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium hover:bg-white/5 hover:text-white transition"
                            >
                                Select Image
                            </label>

                            <input
                                type="file"
                                accept="application/json,.json"
                                onChange={(e) => e.target.files?.[0] && handleJsonSelect(e.target.files[0])}
                                className="hidden"
                                id="json-upload"
                            />
                            <label
                                htmlFor="json-upload"
                                className="cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium hover:bg-white/5 hover:text-white transition"
                            >
                                Select JSON
                            </label>
                        </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleImport}
                            disabled={!imageFile || !jsonFile || loading}
                            className="flex items-center gap-2 rounded-xl bg-[#B7FF00] px-8 py-3 text-sm font-bold text-black shadow-lg shadow-[#B7FF00]/20 transition hover:scale-105 hover:shadow-[#B7FF00]/30 disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Processing Import...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4" />
                                    Start Import
                                </>
                            )}
                        </button>
                    </div>

                    {/* Result Feedback */}
                    {result && (
                        <div className={`rounded-xl border p-5 animate-in fade-in slide-in-from-bottom-2 ${result.success ? "border-green-500/20 bg-green-950/20" : "border-red-500/20 bg-red-950/20"
                            }`}>
                            <div className="flex gap-4">
                                <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${result.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                    }`}>
                                    {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                                </div>
                                <div className="flex-1">
                                    <h4 className={`font-semibold ${result.success ? "text-green-200" : "text-red-200"}`}>
                                        {result.message}
                                    </h4>
                                    {result.created_count && (
                                        <div className="mt-1 text-sm text-white/50">
                                            Successfully processed {result.created_count} templates.
                                        </div>
                                    )}

                                    {result.errors && (
                                        <div className="mt-3 rounded-lg bg-black/20 p-3 text-xs font-mono text-red-300">
                                            {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
                                        </div>
                                    )}

                                    {result.success && (
                                        <div className="mt-4 flex gap-3">
                                            <button
                                                onClick={() => router.push("/admin/prompts")}
                                                className="rounded-lg bg-white/10 px-4 py-2 text-xs font-medium hover:bg-white/20"
                                            >
                                                View Drafts
                                            </button>
                                            <button
                                                onClick={handleReset}
                                                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium hover:bg-white/5"
                                            >
                                                Import Another
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: File Status */}
                <div className="space-y-4">
                    {/* Image Card */}
                    <div className={`relative overflow-hidden rounded-2xl border bg-black/40 transition-all ${imageFile ? "border-[#B7FF00]/50 shadow-[0_0_15px_rgba(183,255,0,0.1)]" : "border-white/5"
                        }`}>
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ImageIcon className={`h-4 w-4 ${imageFile ? "text-[#B7FF00]" : "text-white/40"}`} />
                                <span className="text-sm font-medium text-white/80">Featured Image</span>
                            </div>
                            {imageFile && (
                                <button onClick={() => { setImageFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} className="text-white/20 hover:text-red-400">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <div className="aspect-video w-full bg-black/50 relative flex items-center justify-center">
                            {previewUrl ? (
                                <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                            ) : (
                                <div className="text-xs text-white/20">No image selected</div>
                            )}
                        </div>
                        <div className="p-3 bg-white/5 text-xs text-white/50 truncate">
                            {imageFile ? imageFile.name : "Waiting for upload..."}
                        </div>
                    </div>

                    {/* JSON Card */}
                    <div className={`relative overflow-hidden rounded-2xl border bg-black/40 transition-all ${jsonFile ? "border-[#B7FF00]/50 shadow-[0_0_15px_rgba(183,255,0,0.1)]" : "border-white/5"
                        }`}>
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileJson className={`h-4 w-4 ${jsonFile ? "text-[#B7FF00]" : "text-white/40"}`} />
                                <span className="text-sm font-medium text-white/80">Template Data</span>
                            </div>
                            {jsonFile && (
                                <button onClick={() => setJsonFile(null)} className="text-white/20 hover:text-red-400">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                        <div className="p-6 flex items-center justify-center bg-black/20">
                            <div className={`h-16 w-16 rounded-xl flex items-center justify-center ${jsonFile ? "bg-[#B7FF00]/10 text-[#B7FF00]" : "bg-white/5 text-white/10"
                                }`}>
                                <FileJson className="h-8 w-8" />
                            </div>
                        </div>
                        <div className="p-3 bg-white/5 text-xs text-white/50 truncate">
                            {jsonFile ? jsonFile.name : "Waiting for upload..."}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
