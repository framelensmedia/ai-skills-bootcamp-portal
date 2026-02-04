"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import Loading from "@/components/Loading";
import {
    Plus, BookOpen, Edit, Trash2, Eye, EyeOff, Clock,
    MoreVertical, ChevronRight, GraduationCap
} from "lucide-react";

type Bootcamp = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    thumbnail_url: string | null;
    access_level: string;
    lesson_count: number;
    total_duration_minutes: number;
    is_published: boolean;
    created_at: string;
    lessons: { count: number }[];
};

export default function BootcampsCMSPage() {
    const router = useRouter();
    const { user, initialized } = useAuth();

    const [bootcamps, setBootcamps] = useState<Bootcamp[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMenu, setActionMenu] = useState<string | null>(null);

    useEffect(() => {
        if (initialized) {
            fetchBootcamps();
        }
    }, [initialized]);

    async function fetchBootcamps() {
        try {
            const res = await fetch("/api/cms/bootcamps");
            if (!res.ok) {
                if (res.status === 401) {
                    router.push("/login");
                    return;
                }
                throw new Error("Failed to load bootcamps");
            }
            const data = await res.json();
            setBootcamps(data.bootcamps || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string, title: string) {
        if (!confirm(`Delete "${title}"? This will also delete all lessons.`)) return;

        try {
            const res = await fetch(`/api/cms/bootcamps/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            setBootcamps(prev => prev.filter(b => b.id !== id));
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
        setActionMenu(null);
    }

    async function handleTogglePublish(bootcamp: Bootcamp) {
        try {
            const res = await fetch(`/api/cms/bootcamps/${bootcamp.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_published: !bootcamp.is_published }),
            });
            if (!res.ok) throw new Error("Failed to update");
            setBootcamps(prev => prev.map(b =>
                b.id === bootcamp.id ? { ...b, is_published: !b.is_published } : b
            ));
        } catch (e: any) {
            alert("Failed to update: " + e.message);
        }
        setActionMenu(null);
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
                        <span className="text-[#B7FF00]">Bootcamps</span>
                    </div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <GraduationCap className="text-[#B7FF00]" />
                        Bootcamp Manager
                    </h1>
                </div>

                <Link
                    href="/dashboard/cms/bootcamps/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#B7FF00] px-4 py-2.5 font-semibold text-black hover:bg-[#a3e600] transition"
                >
                    <Plus size={18} />
                    New Bootcamp
                </Link>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}

            {/* Bootcamps List */}
            {bootcamps.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 p-16 text-center">
                    <BookOpen size={48} className="mx-auto mb-4 text-white/20" />
                    <h3 className="text-lg font-semibold mb-2">No bootcamps yet</h3>
                    <p className="text-white/50 mb-6">Create your first bootcamp to start building courses.</p>
                    <Link
                        href="/dashboard/cms/bootcamps/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#B7FF00] px-4 py-2.5 font-semibold text-black hover:bg-[#a3e600] transition"
                    >
                        <Plus size={18} />
                        Create Bootcamp
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {bootcamps.map(bootcamp => (
                        <div
                            key={bootcamp.id}
                            className="group flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/50 p-4 hover:border-white/20 transition"
                        >
                            {/* Thumbnail */}
                            <div className="w-20 h-14 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                                {bootcamp.thumbnail_url ? (
                                    <img src={bootcamp.thumbnail_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/20">
                                        <BookOpen size={24} />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Link
                                        href={`/dashboard/cms/bootcamps/${bootcamp.id}`}
                                        className="font-semibold text-white hover:text-[#B7FF00] truncate"
                                    >
                                        {bootcamp.title}
                                    </Link>

                                    {/* Status badge */}
                                    {bootcamp.is_published ? (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400">
                                            <Eye size={10} />
                                            Published
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-white/10 text-white/50">
                                            <EyeOff size={10} />
                                            Draft
                                        </span>
                                    )}

                                    {bootcamp.access_level === "premium" && (
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                                            Premium
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 text-xs text-white/40">
                                    <span className="flex items-center gap-1">
                                        <BookOpen size={12} />
                                        {bootcamp.lesson_count || bootcamp.lessons?.[0]?.count || 0} lessons
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {bootcamp.total_duration_minutes} min
                                    </span>
                                    <span>/{bootcamp.slug}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/dashboard/cms/bootcamps/${bootcamp.id}`}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 transition"
                                >
                                    Edit
                                </Link>

                                <div className="relative">
                                    <button
                                        onClick={() => setActionMenu(actionMenu === bootcamp.id ? null : bootcamp.id)}
                                        className="p-2 rounded-lg hover:bg-white/10 transition"
                                    >
                                        <MoreVertical size={16} />
                                    </button>

                                    {actionMenu === bootcamp.id && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setActionMenu(null)}
                                            />
                                            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg bg-zinc-800 border border-white/10 shadow-xl py-1">
                                                <button
                                                    onClick={() => handleTogglePublish(bootcamp)}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                                                >
                                                    {bootcamp.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    {bootcamp.is_published ? "Unpublish" : "Publish"}
                                                </button>
                                                <Link
                                                    href={`/learn/${bootcamp.slug}`}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                                                    target="_blank"
                                                >
                                                    <Eye size={14} />
                                                    Preview
                                                </Link>
                                                <hr className="my-1 border-white/10" />
                                                <button
                                                    onClick={() => handleDelete(bootcamp.id, bootcamp.title)}
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
