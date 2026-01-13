"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileJson, Image as ImageIcon, CheckCircle, XCircle, Loader2, ArrowLeft, X, FolderUp, Layers, Search, Plus } from "lucide-react";
import Image from "next/image";

// Types
type Template = {
    id: string;
    title: string;
    slug: string;
    category: string;
    tags: string[];
    preview_image_storage_path?: string;
    status: string;
};

type ImportResult = {
    success: boolean;
    message: string;
    created_count?: number;
    pack_id?: string;
    errors?: string[];
};

export default function TemplateImportPage() {
    const router = useRouter();
    const [mode, setMode] = useState<"single" | "pack" | "existing">("single");

    // Common State
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);

    // Single / Pack Upload State
    const [imageFile, setImageFile] = useState<File | null>(null); // For single
    const [jsonFile, setJsonFile] = useState<File | null>(null);
    const [packFiles, setPackFiles] = useState<File[]>([]); // For pack images
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [detectedTemplates, setDetectedTemplates] = useState<any[]>([]);

    // Existing Selection State
    const [availableTemplates, setAvailableTemplates] = useState<Template[]>([]);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [packMeta, setPackMeta] = useState({ title: "", slug: "", category: "General" });

    // Fetch templates for "Existing" mode
    useEffect(() => {
        if (mode === "existing") {
            fetch(`/api/admin/templates?query=${searchQuery}`)
                .then(res => res.json())
                .then(data => setAvailableTemplates(data.templates || []));
        }
    }, [mode, searchQuery]);

    // Handle File Select (Single)
    const handleImageSelect = (file: File) => {
        if (file && file.type.startsWith("image/")) {
            setImageFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
        }
    };

    const handleJsonSelect = (file: File) => {
        if (file && (file.type === "application/json" || file.name.endsWith(".json"))) {
            setJsonFile(file);
            // If in pack mode, parse it immediately for preview
            if (mode === "pack") {
                parsePackJson(file);
            }
        }
    };

    const parsePackJson = async (file: File) => {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data.templates && Array.isArray(data.templates)) {
                setDetectedTemplates(data.templates);
            }
        } catch (e) {
            console.error("Failed to parse pack json", e);
        }
    };

    // Handle Folder Select (Pack)
    const handleFolderSelect = (files: FileList) => {
        const fileArray = Array.from(files);
        const json = fileArray.find(f => f.name === "pack.json");
        const images = fileArray.filter(f => f.type.startsWith("image/"));

        if (json) {
            setJsonFile(json);
            parsePackJson(json);
        }
        setPackFiles(images);
    };

    // Drag and Drop
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = e.dataTransfer.files;
            if (mode === "single") {
                const img = Array.from(files).find(f => f.type.startsWith("image/"));
                const json = Array.from(files).find(f => f.name.endsWith(".json"));
                if (img) handleImageSelect(img);
                if (json) handleJsonSelect(json);
            } else if (mode === "pack") {
                // If dropping a folder, strict browser support varies. 
                // We'll scan all dropped files.
                handleFolderSelect(files);
            }
        }
    }, [mode]);

    // Submit Logic
    async function handleImport() {
        if (mode === "existing") {
            await handleCreateFromExisting();
            return;
        }

        if (!jsonFile || (mode === "single" && !imageFile)) {
            setResult({ success: false, message: "Missing required files." });
            return;
        }

        setLoading(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append("json", await jsonFile.text());

            if (mode === "single" && imageFile) {
                formData.append("image", imageFile);
            } else if (mode === "pack") {
                packFiles.forEach(f => formData.append("files", f));
            }

            const res = await fetch("/api/admin/templates/import", {
                method: "POST",
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Import failed");
            setResult(data);
        } catch (error: any) {
            setResult({ success: false, message: error.message });
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateFromExisting() {
        if (selectedTemplateIds.length === 0 || !packMeta.title || !packMeta.slug) {
            setResult({ success: false, message: "Please select templates and fill pack details." });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/admin/packs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...packMeta,
                    templates: selectedTemplateIds
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setResult({ success: true, message: "Pack created successfully", pack_id: data.pack_id });
        } catch (e: any) {
            setResult({ success: false, message: e.message });
        } finally {
            setLoading(false);
        }
    }

    // Render Methods
    const renderSuccess = () => (
        <div className={`rounded-xl border p-5 ${result?.success ? "border-green-500/20 bg-green-950/20" : "border-red-500/20 bg-red-950/20"}`}>
            <div className="flex gap-4">
                <div className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${result?.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {result?.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                    <h4 className={`font-semibold ${result?.success ? "text-green-200" : "text-red-200"}`}>{result?.message}</h4>
                    {result?.errors && (
                        <div className="mt-3 rounded-lg bg-black/20 p-3 text-xs font-mono text-red-300">
                            {result.errors.map((e, i) => <div key={i}>• {e}</div>)}
                        </div>
                    )}
                    {result?.success && (
                        <button onClick={() => router.push("/admin/prompts")} className="mt-3 text-xs underline text-white/60 hover:text-white">
                            View in Library
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 text-white">
            <div className="mb-8">
                <button onClick={() => router.back()} className="mb-4 flex items-center gap-2 text-sm text-white/50 hover:text-white transition">
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex justify-between items-center">
                    <h1 className="text-3xl font-bold tracking-tight">Import Templates</h1>
                </div>

                {/* Mode Tabs */}
                <div className="mt-6 flex gap-1 rounded-xl bg-white/5 p-1 w-fit">
                    {(["single", "pack", "existing"] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => { setMode(m); setResult(null); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${mode === m ? "bg-[#B7FF00] text-black shadow-lg" : "text-white/60 hover:text-white hover:bg-white/5"}`}
                        >
                            {m === "single" && "Single Template"}
                            {m === "pack" && "Folder Upload (Pack)"}
                            {m === "existing" && "Create Pack from Existing"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Mode 1 & 2: Upload */}
                    {(mode === "single" || mode === "pack") && (
                        <>
                            <div
                                className={`relative flex min-h-[300px] flex-col items-center justify-center rounded-3xl border-2 border-dashed p-10 text-center transition-all ${dragActive ? "border-[#B7FF00]" : "border-white/10 bg-black/20"}`}
                                onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                            >
                                <Upload className="h-10 w-10 text-white/20 mb-4" />
                                <h3 className="text-lg font-semibold">
                                    {mode === "single" ? "Drag Image & JSON" : "Drag Pack Folder"}
                                </h3>
                                <p className="mt-2 text-sm text-white/50 max-w-sm mb-6">
                                    {mode === "single" ? "Drop .json and image (PNG/JPG)" : "Drop a folder containing pack.json and images (or click below)"}
                                </p>

                                <div className="flex gap-3">
                                    {mode === "single" ? (
                                        <>
                                            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])} className="hidden" id="img-in" />
                                            <label htmlFor="img-in" className="btn-secondary">Select Image</label>

                                            <input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && handleJsonSelect(e.target.files[0])} className="hidden" id="json-in" />
                                            <label htmlFor="json-in" className="btn-secondary">Select JSON</label>
                                        </>
                                    ) : (
                                        <>
                                            <input
                                                type="file"
                                                // @ts-ignore
                                                webkitdirectory="" directory="" multiple
                                                onChange={(e) => e.target.files && handleFolderSelect(e.target.files)}
                                                className="hidden" id="folder-in"
                                            />
                                            <label htmlFor="folder-in" className="btn-primary">Select Folder</label>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end">
                                <button onClick={handleImport} disabled={loading || !jsonFile} className="btn-primary">
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start Import"}
                                </button>
                            </div>
                        </>
                    )}

                    {/* Mode 3: Existing */}
                    {mode === "existing" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-white/50 mb-1 block">Pack Title</label>
                                    <input placeholder="Ex: Restaurant Pack" className="input-field" value={packMeta.title} onChange={e => setPackMeta({ ...packMeta, title: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-xs text-white/50 mb-1 block">Slug</label>
                                    <input placeholder="Ex: restaurant-pack" className="input-field" value={packMeta.slug} onChange={e => setPackMeta({ ...packMeta, slug: e.target.value })} />
                                </div>
                            </div>

                            <div className="border border-white/10 rounded-xl p-4 bg-black/20">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-semibold">Select Templates</h3>
                                    <div className="flex items-center bg-black/40 px-3 py-1 rounded-lg border border-white/10 w-full max-w-[200px]">
                                        <Search className="h-3 w-3 text-white/40 mr-2" />
                                        <input
                                            placeholder="Search templates..."
                                            className="bg-transparent text-sm w-full outline-none"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {availableTemplates.map(t => (
                                        <div key={t.id}
                                            onClick={() => setSelectedTemplateIds(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                                            className={`p-3 rounded-lg flex items-center justify-between cursor-pointer border transition ${selectedTemplateIds.includes(t.id) ? "border-[#B7FF00] bg-[#B7FF00]/10" : "border-white/5 hover:bg-white/5"}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {/* Assuming image might exist, simplistic placeholder if not */}
                                                <div className="h-8 w-8 rounded bg-white/10 overflow-hidden relative">
                                                    {t.preview_image_storage_path && (
                                                        <Image
                                                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/bootcamp-assets/${t.preview_image_storage_path}`}
                                                            alt="" fill className="object-cover"
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-medium">{t.title}</div>
                                                    <div className="text-xs text-white/50">{t.slug}</div>
                                                </div>
                                            </div>
                                            {selectedTemplateIds.includes(t.id) && <CheckCircle className="h-4 w-4 text-[#B7FF00]" />}
                                        </div>
                                    ))}
                                    {availableTemplates.length === 0 && (
                                        <div className="text-center py-8 text-white/20 text-sm">No templates found</div>
                                    )}
                                </div>
                                <div className="mt-4 flex justify-between items-center text-xs text-white/50 border-t border-white/5 pt-3">
                                    <span>{selectedTemplateIds.length} templates selected</span>
                                    {selectedTemplateIds.length > 0 && <span className="text-[#B7FF00]">Ready to create</span>}
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button onClick={handleImport} disabled={loading || selectedTemplateIds.length === 0} className="btn-primary">
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Pack"}
                                </button>
                            </div>
                        </div>
                    )}

                    {result && renderSuccess()}
                </div>

                {/* Sidebar Status */}
                <div className="space-y-4">
                    <div className="card p-4 space-y-4">
                        <h4 className="font-semibold text-sm text-white/60">Selected Assets</h4>
                        {jsonFile && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 animate-in fade-in slide-in-from-right-4">
                                <FileJson className="h-5 w-5 text-[#B7FF00]" />
                                <div className="overflow-hidden">
                                    <div className="truncate text-sm font-medium">{jsonFile.name}</div>
                                    <div className="text-xs text-white/50">
                                        {mode === "pack" ? `${detectedTemplates.length} templates defined` : "Config file"}
                                    </div>
                                </div>
                            </div>
                        )}
                        {(imageFile || packFiles.length > 0) && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 animate-in fade-in slide-in-from-right-5">
                                <ImageIcon className="h-5 w-5 text-[#B7FF00]" />
                                <div>
                                    <div className="text-sm font-medium">
                                        {mode === "single" ? imageFile?.name : `${packFiles.length} Images`}
                                    </div>
                                    {mode === "pack" && <div className="text-xs text-white/50">Ready to upload</div>}
                                </div>
                            </div>
                        )}
                        {!jsonFile && !imageFile && packFiles.length === 0 && (
                            <div className="text-xs text-white/30 text-center py-8">
                                No assets selected
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                .btn-primary {
                    @apply flex items-center gap-2 rounded-xl bg-[#B7FF00] px-6 py-2 text-sm font-bold text-black transition hover:scale-105 hover:shadow-[#B7FF00]/20 disabled:opacity-50 disabled:scale-100;
                }
                .btn-secondary {
                    @apply cursor-pointer rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm font-medium hover:bg-white/5 hover:text-white transition;
                }
                .input-field {
                    @apply w-full rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white focus:border-[#B7FF00] focus:outline-none;
                }
                .card {
                    @apply rounded-xl border border-white/10 bg-black/30;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                }
            `}</style>
        </div>
    );
}
