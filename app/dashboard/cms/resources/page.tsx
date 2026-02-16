"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import Loading from "@/components/Loading";
import {
    Plus, FolderOpen, Trash2, Eye, EyeOff, FileText, Download,
    MoreVertical, ChevronRight, Video, Link as LinkIcon, Image as ImageIcon
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Resource = {
    id: string;
    title: string;
    description: string | null;
    url: string;
    type: string | null;
    is_public: boolean;
    created_at: string;
    downloads_count: number;
    file_size_bytes: number | null;
};

export default function ResourcesCMSPage() {
    const router = useRouter();
    const { user, initialized } = useAuth();
    const supabase = createSupabaseBrowserClient();

    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMenu, setActionMenu] = useState<string | null>(null);

    useEffect(() => {
        if (initialized) {
            fetchResources();
        }
    }, [initialized]);

    async function fetchResources() {
        try {
            const { data, error } = await supabase
                .from("resources")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setResources(data || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string, title: string) {
        if (!confirm(`Delete "${title}"?`)) return;

        try {
            const { error } = await supabase
                .from("resources")
                .delete()
                .eq("id", id);

            if (error) throw error;
            setResources(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
        setActionMenu(null);
    }

    async function handleTogglePublic(resource: Resource) {
        try {
            const { error } = await supabase
                .from("resources")
                .update({ is_public: !resource.is_public })
                .eq("id", resource.id);

            if (error) throw error;

            setResources(prev => prev.map(r =>
                r.id === resource.id ? { ...r, is_public: !r.is_public } : r
            ));
        } catch (e: any) {
            alert("Failed to update: " + e.message);
        }
        setActionMenu(null);
    }

    function getIconForType(type: string | null) {
        if (!type) return <FileText size={24} />;
        if (type.startsWith("image/")) return <ImageIcon size={24} />;
        if (type.startsWith("video/")) return <Video size={24} />;
        if (type === "link") return <LinkIcon size={24} />;
        if (type.includes("pdf")) return <FileText size={24} />;
        return <FileText size={24} />;
    }

    function formatBytes(bytes: number | null) {
        if (!bytes) return "";
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    if (!initialized || loading) return <Loading />;

    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white font-sans">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-1">
                        <Link href="/dashboard/cms" className="hover:text-white">CMS</Link>
                        <ChevronRight size={12} />
                        <span className="text-[#6BCB77]">Resources</span>
                    </div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <FolderOpen className="text-[#6BCB77]" />
                        Resource Library
                    </h1>
                </div>

                <Link
                    href="/dashboard/cms/resources/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#6BCB77] px-4 py-2.5 font-semibold text-black hover:bg-[#5ab666] transition"
                >
                    <Plus size={18} />
                    Upload Resource
                </Link>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}

            {/* Resources List */}
            {resources.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 p-16 text-center">
                    <FolderOpen size={48} className="mx-auto mb-4 text-white/20" />
                    <h3 className="text-lg font-semibold mb-2">No resources yet</h3>
                    <p className="text-white/50 mb-6">Upload files or links to share with users.</p>
                    <Link
                        href="/dashboard/cms/resources/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#6BCB77] px-4 py-2.5 font-semibold text-black hover:bg-[#5ab666] transition"
                    >
                        <Plus size={18} />
                        Upload Resource
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {resources.map(resource => (
                        <div
                            key={resource.id}
                            className="group flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/50 p-4 hover:border-white/20 transition"
                        >
                            {/* Icon */}
                            <div className="w-14 h-14 rounded-lg bg-zinc-800 flex items-center justify-center text-white/40 shrink-0">
                                {getIconForType(resource.type)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Link
                                        href={`/dashboard/cms/resources/${resource.id}`}
                                        className="font-semibold text-white hover:text-[#6BCB77] truncate"
                                    >
                                        {resource.title}
                                    </Link>

                                    {/* Status badge */}
                                    {resource.is_public ? (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                                            <Eye size={10} />
                                            Public
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/50">
                                            <EyeOff size={10} />
                                            Private
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 text-xs text-white/40">
                                    <span>{resource.type || "unknown"}</span>
                                    {resource.file_size_bytes && (
                                        <span>• {formatBytes(resource.file_size_bytes)}</span>
                                    )}
                                    <span>• {resource.downloads_count} downloads</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <Link
                                    href={resource.url}
                                    target="_blank"
                                    className="p-2 rounded-lg text-white/40 hover:bg-white/10 hover:text-white transition"
                                    title="Download/View"
                                >
                                    <Download size={18} />
                                </Link>

                                <Link
                                    href={`/dashboard/cms/resources/${resource.id}`}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 transition"
                                >
                                    Edit
                                </Link>

                                <div className="relative">
                                    <button
                                        onClick={() => setActionMenu(actionMenu === resource.id ? null : resource.id)}
                                        className="p-2 rounded-lg hover:bg-white/10 transition"
                                    >
                                        <MoreVertical size={16} />
                                    </button>

                                    {actionMenu === resource.id && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setActionMenu(null)}
                                            />
                                            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg bg-zinc-800 border border-white/10 shadow-xl py-1">
                                                <button
                                                    onClick={() => handleTogglePublic(resource)}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                                                >
                                                    {resource.is_public ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    {resource.is_public ? "Make Private" : "Make Public"}
                                                </button>
                                                <hr className="my-1 border-white/10" />
                                                <button
                                                    onClick={() => handleDelete(resource.id, resource.title)}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-500/10 text-red-400 flex items-center gap-2"
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
