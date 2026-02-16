"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import Loading from "@/components/Loading";
import {
    ChevronRight, Save, ArrowLeft, Upload, Link as LinkIcon, FileText
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import ThumbnailUploader from "@/components/cms/ThumbnailUploader"; // We can reuse or adapt this

export default function ResourceEditorPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const isNew = id === "new";

    const router = useRouter();
    const { user, initialized } = useAuth();
    const supabase = createSupabaseBrowserClient();

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        url: "",
        type: "link", // 'link' or file type
        is_public: true,
        file_size_bytes: 0
    });

    useEffect(() => {
        if (!isNew && initialized) {
            fetchResource();
        }
    }, [id, initialized, isNew]);

    async function fetchResource() {
        try {
            const { data, error } = await supabase
                .from("resources")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            if (data) {
                setFormData({
                    title: data.title || "",
                    description: data.description || "",
                    url: data.url || "",
                    type: data.type || "link",
                    is_public: data.is_public ?? true,
                    file_size_bytes: data.file_size_bytes || 0
                });
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                url: formData.url,
                type: formData.type,
                is_public: formData.is_public,
                file_size_bytes: formData.file_size_bytes,
                updated_at: new Date().toISOString()
            };

            if (isNew) {
                const { error } = await supabase
                    .from("resources")
                    .insert([payload]);
                if (error) throw error;
                router.push("/dashboard/cms/resources");
            } else {
                const { error } = await supabase
                    .from("resources")
                    .update(payload)
                    .eq("id", id);
                if (error) throw error;
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    // Adapt ThumbnailUploader for generic file upload isn't perfect, so we'll use a simple file input for now
    // or just let them paste a URL if it's external.
    // For MVP, we can treat "Upload" as uploading to the `bootcamp-assets` bucket under `resources/`

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setSaving(true);
        try {
            const filename = `resources/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
            const { data, error } = await supabase.storage
                .from("bootcamp-assets")
                .upload(filename, file);

            if (error) throw error;

            const { data: urlData } = supabase.storage
                .from("bootcamp-assets")
                .getPublicUrl(data.path);

            setFormData(prev => ({
                ...prev,
                url: urlData.publicUrl,
                type: file.type,
                file_size_bytes: file.size,
                title: prev.title || file.name // Auto-fill title if empty
            }));
        } catch (err: any) {
            setError("Upload failed: " + err.message);
        } finally {
            setSaving(false);
        }
    }

    if (!initialized || loading) return <Loading />;

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 text-white font-sans">
            <form onSubmit={handleSubmit}>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-1">
                            <Link href="/dashboard/cms" className="hover:text-white">CMS</Link>
                            <ChevronRight size={12} />
                            <Link href="/dashboard/cms/resources" className="hover:text-white">Resources</Link>
                            <ChevronRight size={12} />
                            <span className="text-[#6BCB77]">{isNew ? "New Resource" : "Edit Resource"}</span>
                        </div>
                        <h1 className="text-2xl font-bold">
                            {isNew ? "Upload Resource" : "Edit Resource"}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard/cms/resources"
                            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={saving || !formData.url}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#6BCB77] px-6 py-2.5 font-semibold text-black hover:bg-[#5ab666] transition disabled:opacity-50"
                        >
                            {saving ? (
                                <span className="animate-spin duration-300">⟳</span>
                            ) : (
                                <Save size={18} />
                            )}
                            {saving ? "Saving..." : "Save Resource"}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                        {error}
                    </div>
                )}

                <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/60">Title</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-lg font-medium focus:border-[#6BCB77] focus:outline-none"
                                placeholder="Resource title..."
                                required
                            />
                        </div>

                        <div className="space-y-4 rounded-xl border border-white/10 bg-zinc-900/50 p-6">
                            <h3 className="font-semibold flex items-center gap-2">
                                <LinkIcon size={18} className="text-[#6BCB77]" />
                                File or Link
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className={`
                                    flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition
                                    ${formData.type !== 'link' && formData.url ? 'border-[#6BCB77] bg-[#6BCB77]/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}
                                `}>
                                    <Upload size={24} className={formData.type !== 'link' && formData.url ? "text-[#6BCB77]" : "text-white/40"} />
                                    <span className="text-sm font-medium">Upload File</span>
                                    <input type="file" onChange={handleFileUpload} className="hidden" />
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, type: 'link', url: '' }))}
                                    className={`
                                        flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed transition
                                        ${formData.type === 'link' ? 'border-[#6BCB77] bg-[#6BCB77]/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}
                                    `}
                                >
                                    <LinkIcon size={24} className={formData.type === 'link' ? "text-[#6BCB77]" : "text-white/40"} />
                                    <span className="text-sm font-medium">External URL</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60">
                                    {formData.type === 'link' ? 'URL' : 'File URL'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.url}
                                    onChange={e => setFormData(prev => ({ ...prev, url: e.target.value, type: prev.type === 'link' ? 'link' : prev.type }))}
                                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-[#6BCB77] focus:outline-none"
                                    placeholder="https://..."
                                    readOnly={formData.type !== 'link'}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/60">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                className="w-full h-32 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm focus:border-[#6BCB77] focus:outline-none resize-none"
                                placeholder="Describe this resource..."
                            />
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5 space-y-4">
                            <h3 className="font-semibold text-sm">Settings</h3>

                            <label className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-black/20 cursor-pointer hover:bg-black/30 transition">
                                <input
                                    type="checkbox"
                                    checked={formData.is_public}
                                    onChange={e => setFormData(prev => ({ ...prev, is_public: e.target.checked }))}
                                    className="w-5 h-5 rounded border-white/20 bg-zinc-800 text-[#6BCB77] focus:ring-[#6BCB77]"
                                />
                                <span className="text-sm font-medium">Publicly Accessible</span>
                            </label>

                            <div className="pt-4 border-t border-white/10 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">File Type</span>
                                    <span className="font-mono">{formData.type || "-"}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Size</span>
                                    <span className="font-mono">{formData.file_size_bytes ? (formData.file_size_bytes / 1024 / 1024).toFixed(2) + " MB" : "-"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </main>
    );
}
