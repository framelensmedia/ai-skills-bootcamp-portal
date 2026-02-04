"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Save, Loader2, GraduationCap, ChevronRight, Plus,
    Sparkles, Eye, EyeOff, Trash2, GripVertical, Clock, Edit, MoreVertical
} from "lucide-react";
import Loading from "@/components/Loading";
import type { Bootcamp, Lesson } from "@/lib/types/learning-flow";
import ThumbnailUploader from "@/components/cms/ThumbnailUploader";

type Props = {
    params: Promise<{ id: string }>;
};

export default function EditBootcampPage({ params }: Props) {
    const { id } = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [bootcamp, setBootcamp] = useState<Bootcamp | null>(null);
    const [lessons, setLessons] = useState<Lesson[]>([]);
    const [actionMenu, setActionMenu] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: "",
        slug: "",
        description: "",
        thumbnail_url: "",
        access_level: "free",
        is_published: false,
    });

    useEffect(() => {
        fetchBootcamp();
    }, [id]);

    async function fetchBootcamp() {
        try {
            const res = await fetch(`/api/cms/bootcamps/${id}`);
            if (!res.ok) {
                if (res.status === 404) throw new Error("Bootcamp not found");
                if (res.status === 401) {
                    router.push("/login");
                    return;
                }
                throw new Error("Failed to load bootcamp");
            }
            const data = await res.json();
            setBootcamp(data.bootcamp);
            setLessons(data.lessons || []);
            setForm({
                title: data.bootcamp.title || "",
                slug: data.bootcamp.slug || "",
                description: data.bootcamp.description || "",
                thumbnail_url: data.bootcamp.thumbnail_url || "",
                access_level: data.bootcamp.access_level || "free",
                is_published: data.bootcamp.is_published || false,
            });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const handleChange = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
        setSuccess(null);
    };

    const handleSave = async () => {
        setError(null);
        setSuccess(null);
        setSaving(true);

        try {
            const res = await fetch(`/api/cms/bootcamps/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to save bootcamp");
            }

            setBootcamp(data.bootcamp);
            setSuccess("Bootcamp saved successfully!");

        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteLesson = async (lesson: Lesson) => {
        if (!confirm(`Delete Learning Flow "${lesson.title}"?`)) return;

        try {
            const res = await fetch(`/api/cms/lessons/${lesson.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            setLessons(prev => prev.filter(l => l.id !== lesson.id));
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
        setActionMenu(null);
    };

    const handleToggleLessonPublish = async (lesson: Lesson) => {
        try {
            const res = await fetch(`/api/cms/lessons/${lesson.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_published: !lesson.is_published }),
            });
            if (!res.ok) throw new Error("Failed to update");
            setLessons(prev => prev.map(l =>
                l.id === lesson.id ? { ...l, is_published: !l.is_published } : l
            ));
        } catch (e: any) {
            alert("Failed to update: " + e.message);
        }
        setActionMenu(null);
    };

    if (loading) return <Loading />;

    if (!bootcamp) {
        return (
            <main className="mx-auto w-full max-w-3xl px-4 py-8 text-white">
                <Link href="/dashboard/cms/bootcamps" className="flex items-center gap-2 text-white/60 hover:text-white mb-8">
                    <ArrowLeft size={20} />
                    Back to Bootcamps
                </Link>
                <div className="text-center py-20">
                    <p className="text-xl text-white/60">{error || "Bootcamp not found"}</p>
                </div>
            </main>
        );
    }

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 text-white font-sans">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-2">
                    <Link href="/dashboard/cms" className="hover:text-white">CMS</Link>
                    <ChevronRight size={12} />
                    <Link href="/dashboard/cms/bootcamps" className="hover:text-white">Bootcamps</Link>
                    <ChevronRight size={12} />
                    <span className="text-[#B7FF00]">Edit</span>
                </div>
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <GraduationCap className="text-[#B7FF00]" />
                        Edit Bootcamp
                    </h1>
                    <Link
                        href={`/learn/${bootcamp.slug}`}
                        target="_blank"
                        className="flex items-center gap-2 text-sm text-white/60 hover:text-white"
                    >
                        <Eye size={16} />
                        Preview
                    </Link>
                </div>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-200">
                    {success}
                </div>
            )}

            <div className="grid gap-8 lg:grid-cols-[1fr,360px]">
                {/* Main Form */}
                <div className="space-y-6">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Title <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => handleChange("title", e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white focus:border-[#B7FF00] focus:outline-none"
                        />
                    </div>

                    {/* Slug */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            URL Slug
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-white/40">/learn/</span>
                            <input
                                type="text"
                                value={form.slug}
                                onChange={(e) => handleChange("slug", e.target.value)}
                                className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white focus:border-[#B7FF00] focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Description
                        </label>
                        <textarea
                            value={form.description}
                            onChange={(e) => handleChange("description", e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white focus:border-[#B7FF00] focus:outline-none resize-none"
                        />
                    </div>

                    {/* Thumbnail */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Thumbnail
                        </label>
                        <ThumbnailUploader
                            currentUrl={form.thumbnail_url}
                            onUpload={(url) => handleChange("thumbnail_url", url)}
                        />
                    </div>

                    {/* Access & Publish */}
                    <div className="flex gap-6">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Access</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleChange("access_level", "free")}
                                    className={`px-4 py-2 rounded-lg border text-sm transition ${form.access_level === "free"
                                        ? "border-[#B7FF00] bg-[#B7FF00]/10 text-[#B7FF00]"
                                        : "border-white/10 text-white/60"
                                        }`}
                                >
                                    Free
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleChange("access_level", "premium")}
                                    className={`px-4 py-2 rounded-lg border text-sm transition ${form.access_level === "premium"
                                        ? "border-amber-500 bg-amber-500/10 text-amber-400"
                                        : "border-white/10 text-white/60"
                                        }`}
                                >
                                    Premium
                                </button>
                            </div>
                        </div>

                        <div className="flex items-end">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.is_published}
                                    onChange={(e) => handleChange("is_published", e.target.checked)}
                                    className="w-5 h-5 rounded border-white/20 bg-zinc-800 text-[#B7FF00]"
                                />
                                <span className="text-sm">Published</span>
                            </label>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 rounded-lg bg-[#B7FF00] px-6 py-2.5 font-semibold text-black hover:bg-[#a3e600] disabled:opacity-50 transition"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Learning Flows Panel */}
                <div className="lg:border-l lg:border-white/10 lg:pl-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold flex items-center gap-2">
                            <Sparkles size={18} className="text-[#B7FF00]" />
                            Learning Flows ({lessons.length})
                        </h2>
                        <Link
                            href={`/dashboard/cms/bootcamps/${id}/lessons/new`}
                            className="flex items-center gap-1 text-sm text-[#B7FF00] hover:underline"
                        >
                            <Plus size={16} />
                            Add
                        </Link>
                    </div>

                    {lessons.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-white/20 p-8 text-center">
                            <Sparkles size={32} className="mx-auto mb-3 text-white/20" />
                            <p className="text-sm text-white/50 mb-4">No Learning Flows yet</p>
                            <Link
                                href={`/dashboard/cms/bootcamps/${id}/lessons/new`}
                                className="inline-flex items-center gap-2 text-sm text-[#B7FF00] hover:underline"
                            >
                                <Plus size={16} />
                                Create first Learning Flow
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {lessons.map((lesson, index) => (
                                <div
                                    key={lesson.id}
                                    className="group flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900/50 p-3 hover:border-white/20"
                                >
                                    {/* Order number */}
                                    <div className="flex items-center justify-center w-6 h-6 rounded bg-white/10 text-xs font-bold text-white/60">
                                        {index + 1}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <Link
                                            href={`/dashboard/cms/bootcamps/${id}/lessons/${lesson.id}`}
                                            className="text-sm font-medium text-white hover:text-[#B7FF00] truncate block"
                                        >
                                            {lesson.title}
                                        </Link>
                                        <div className="flex items-center gap-2 text-xs text-white/40">
                                            <span className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {lesson.duration_minutes}m
                                            </span>
                                            {lesson.is_published ? (
                                                <span className="text-green-400">Published</span>
                                            ) : (
                                                <span>Draft</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setActionMenu(actionMenu === lesson.id ? null : lesson.id)}
                                            className="p-1 rounded hover:bg-white/10"
                                        >
                                            <MoreVertical size={14} />
                                        </button>

                                        {actionMenu === lesson.id && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />
                                                <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-lg bg-zinc-800 border border-white/10 shadow-xl py-1">
                                                    <Link
                                                        href={`/dashboard/cms/bootcamps/${id}/lessons/${lesson.id}`}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                                                    >
                                                        <Edit size={12} />
                                                        Edit
                                                    </Link>
                                                    <button
                                                        onClick={() => handleToggleLessonPublish(lesson)}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                                                    >
                                                        {lesson.is_published ? <EyeOff size={12} /> : <Eye size={12} />}
                                                        {lesson.is_published ? "Unpublish" : "Publish"}
                                                    </button>
                                                    <hr className="my-1 border-white/10" />
                                                    <button
                                                        onClick={() => handleDeleteLesson(lesson)}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-red-500/10 text-red-400 flex items-center gap-2"
                                                    >
                                                        <Trash2 size={12} />
                                                        Delete
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
