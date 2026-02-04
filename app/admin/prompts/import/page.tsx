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
        }
    };

    const validateAndParsePackJson = async (file: File, relatedFiles: File[]) => {
        try {
            const text = await file.text();
            // Strip comments (// and /* */) to handle user-provided JSON
            const cleanText = text.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g1) => g1 ? "" : m);
            const data = JSON.parse(cleanText);

            // 1. Pack ID Match - validation skipped (filename is authority)
            /* 
            const packIdFromFilename = file.name.replace(/\.json$/i, "");
            const packIdFromJson = data.pack?.id || data.pack?.pack_id;
            */

            // 2. Image Validation (Relaxed to allow extension mismatch)
            const missingImages: string[] = [];
            const fileNames = new Set(relatedFiles.map(f => f.name));
            const baseNames = new Set(relatedFiles.map(f => f.name.replace(/\.[^/.]+$/, "")));

            const exists = (jsonPath: string) => {
                if (!jsonPath) return true;

                // Normalize JSON path: strip folder, lowercase
                const jsonBase = jsonPath.split(/[/\\]/).pop()?.toLowerCase() || "";

                // Check against uploaded files (names are already basenames in browser File object)
                return relatedFiles.some(f => {
                    const fileBase = f.name.toLowerCase();

                    // Exact match (ignoring case/path)
                    if (fileBase === jsonBase) return true;

                    // Match without extension (legacy support)
                    const fileBaseNoExt = fileBase.replace(/\.[^/.]+$/, "");
                    const jsonBaseNoExt = jsonBase.replace(/\.[^/.]+$/, "");
                    return fileBaseNoExt === jsonBaseNoExt;
                });
            };

            // Check Thumbnail
            if (data.pack?.thumbnail_filename && !exists(data.pack.thumbnail_filename)) {
                missingImages.push(data.pack.thumbnail_filename);
            }

            // Check Templates
            if (data.templates && Array.isArray(data.templates)) {
                data.templates.forEach((t: any) => {
                    const img = t.featured_image_filename || t.featured_image;
                    if (img && !exists(img)) {
                        missingImages.push(img);
                    }
                });
                setDetectedTemplates(data.templates);
            }

            if (missingImages.length > 0) {
                setResult({
                    success: false,
                    message: "Missing referenced images:",
                    errors: missingImages.map(f => `File not found: ${f}`)
                });
                return;
            }

            setJsonFile(file);
            setPackFiles(relatedFiles);
            setResult(null); // Clear errors

        } catch (e) {
            console.error("Failed to parse pack json", e);
            setResult({ success: false, message: "Invalid JSON file." });
        }
    };

    // Handle Folder Select (Pack)
    // Handle Folder Select (Pack)
    const handleFolderSelect = (files: FileList) => {
        const fileArray = Array.from(files);
        console.log("handleFolderSelect received files:", fileArray.map(f => f.name));
        // Sanitize check: trim whitespace from names to handle accidentally renamed files
        const jsonFiles = fileArray.filter(f => f.name.trim().toLowerCase().endsWith(".json"));
        const images = fileArray.filter(f => f.type.startsWith("image/"));

        if (jsonFiles.length === 0) {
            console.error("No JSON files found in selection");

            // Check for common issues
            const zipFile = fileArray.find(f => f.name.toLowerCase().endsWith(".zip"));
            if (zipFile) {
                setResult({
                    success: false,
                    message: `Found ZIP file (${zipFile.name}) but no JSON. Please unzip the pack first and drop the folder.`
                });
                return;
            }

            const fileListStr = fileArray.length > 0
                ? `Found ${fileArray.length} files: ${fileArray.map(f => f.name).slice(0, 5).join(", ")}${fileArray.length > 5 ? "..." : ""}`
                : "No files detected.";

            setResult({
                success: false,
                message: `Missing pack JSON file. ${fileListStr}`
            });
            return;
        }
        if (jsonFiles.length > 1) {
            setResult({ success: false, message: "Only one JSON file is allowed per pack upload." });
            return;
        }

        validateAndParsePackJson(jsonFiles[0], images);
    };

    // Drag and Drop
    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
        else if (e.type === "dragleave") setDragActive(false);
    }, []);

    // Recursive scan for dropped items
    const scanFiles = async (item: DataTransferItem): Promise<File[]> => {
        // @ts-ignore
        if (item.webkitGetAsEntry) {
            // @ts-ignore
            const entry = item.webkitGetAsEntry();
            console.log("Entry found:", entry);
            if (entry) {
                return scanEntry(entry);
            }
        }
        console.log("No entry found, trying getAsFile");
        return item.getAsFile() ? [item.getAsFile()!] : [];
    };

    const scanEntry = async (entry: any): Promise<File[]> => {
        if (entry.isFile) {
            return new Promise((resolve) => {
                entry.file((file: File) => {
                    console.log("File found in scan:", file.name);
                    resolve([file]);
                });
            });
        }
        else if (entry.isDirectory) {
            console.log("Directory found:", entry.name);
            const dirReader = entry.createReader();
            const allEntries: any[] = [];

            const readBatch = async (): Promise<void> => {
                // readEntries might return empty array when finished, or error
                try {
                    const batch = await new Promise<any[]>((resolve, reject) => {
                        dirReader.readEntries(resolve, reject);
                    });

                    if (batch.length > 0) {
                        allEntries.push(...batch);
                        await readBatch();
                    }
                } catch (e) {
                    console.error("Error reading dir batch:", e);
                }
            };

            await readBatch();

            // Map entries to files
            const files = await Promise.all(allEntries.map(scanEntry));
            return files.flat();
        }
        return [];
    };

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        console.log("Drop event:", e.dataTransfer);
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            const items = Array.from(e.dataTransfer.items);
            console.log("Items to scan:", items);

            // If pack mode, scan recursively
            if (mode === "pack") {
                const results = await Promise.all(items.map(item => scanFiles(item)));
                const allFiles = results.flat().filter((f): f is File => f !== null);
                console.log("All scanned files:", allFiles.map(f => f.name));

                // Construct a DataTransfer to reuse handleFolderSelect logic which expects FileList
                const dt = new DataTransfer();
                allFiles.forEach(f => dt.items.add(f));
                handleFolderSelect(dt.files);
            }
            else if (mode === "single") {
                // Legacy simple handling for single files
                const files = Array.from(e.dataTransfer.files);
                const img = files.find(f => f.type.startsWith("image/"));
                const json = files.find(f => f.name.endsWith(".json"));
                if (img) handleImageSelect(img);
                if (json) handleJsonSelect(json);
            }
        }
        else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            console.log("Handling as simple files list (fallback)");
            const files = e.dataTransfer.files;
            if (mode === "single") {
                const img = Array.from(files).find(f => f.type.startsWith("image/"));
                const json = Array.from(files).find(f => f.name.endsWith(".json"));
                if (img) handleImageSelect(img);
                if (json) handleJsonSelect(json);
            } else if (mode === "pack") {
                handleFolderSelect(files);
            }
        }
    }, [mode]);

    // Helper to calculate aspect ratio
    const getImageAspectRatio = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const img = new window.Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const ratio = img.width / img.height;
                URL.revokeObjectURL(url);
                // Match to standards (with 15% tolerance)
                if (Math.abs(ratio - 9 / 16) < 0.15) resolve("9:16");
                else if (Math.abs(ratio - 4 / 5) < 0.15) resolve("4:5");
                else if (Math.abs(ratio - 3 / 4) < 0.15) resolve("3:4");
                else if (Math.abs(ratio - 1) < 0.15) resolve("1:1");
                else if (Math.abs(ratio - 16 / 9) < 0.15) resolve("16:9");
                else resolve("9:16"); // Default
            };
            img.onerror = () => resolve("9:16");
            img.src = url;
        });
    };

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
            let jsonString = await jsonFile.text();

            // --- Auto-Detect Aspect Ratios ---
            try {
                const jsonData = JSON.parse(jsonString);

                if (mode === "pack" && jsonData.templates && Array.isArray(jsonData.templates)) {
                    // Create lookup map for pack files
                    const fileMap = new Map<string, File>();
                    packFiles.forEach(f => {
                        fileMap.set(f.name, f);
                        fileMap.set(f.name.toLowerCase(), f);
                        // Also map basename without extension
                        const base = f.name.replace(/\.[^/.]+$/, "");
                        fileMap.set(base, f);
                        fileMap.set(base.toLowerCase(), f);
                    });

                    for (const tpl of jsonData.templates) {
                        const imgName = tpl.featured_image || tpl.featured_image_filename;
                        // Only auto-detect if not explicitly set in JSON
                        if (imgName && (!tpl.aspect_ratios || tpl.aspect_ratios.length === 0)) {
                            // Find file
                            let f = fileMap.get(imgName);
                            if (!f && imgName.includes(".")) {
                                // Try without extension
                                f = fileMap.get(imgName.replace(/\.[^/.]+$/, ""));
                            }
                            // Try lowercase
                            if (!f) f = fileMap.get(imgName.toLowerCase());

                            if (f) {
                                const ratio = await getImageAspectRatio(f);
                                tpl.aspect_ratios = [ratio];
                                console.log(`Auto-detected ratio for ${imgName}: ${ratio}`);
                            }
                        }
                    }
                    jsonString = JSON.stringify(jsonData);
                }
                else if (mode === "single" && jsonData.type === "single_template" && imageFile) {
                    if (!jsonData.template.aspect_ratios || jsonData.template.aspect_ratios.length === 0) {
                        const ratio = await getImageAspectRatio(imageFile);
                        jsonData.template.aspect_ratios = [ratio];
                        jsonString = JSON.stringify(jsonData);
                        console.log(`Auto-detected ratio for single template: ${ratio}`);
                    }
                }
            } catch (preError) {
                console.warn("Aspect ratio detection skipped due to parse error:", preError);
            }
            // ---------------------------------

            formData.append("json", jsonString);
            formData.append("filename_id", jsonFile.name.replace(/\.json$/i, ""));

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
                                    {mode === "single" ? "Drop .json and image (PNG/JPG)" : "Drop a folder containing <pack_id>.json and all referenced images."}
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
