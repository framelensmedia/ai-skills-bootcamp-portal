"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Save, Loader2, BookOpen, ChevronRight,
    Sparkles, Trash2, Play, Eye
} from "lucide-react";
import type { Lesson } from "@/lib/types/learning-flow";
import TemplateSelector from "@/components/cms/TemplateSelector";
import VideoManager from "@/components/cms/VideoManager";

type Props = {
    params: Promise<{ id: string; lessonId: string }>;
};

type VideoItem = {
    id?: string;
    video_url: string;
    title: string;
    description?: string;
    order_index: number;
    duration_seconds: number;
    thumbnail_url?: string;
    is_published?: boolean;
};

export default function EditLearningFlowPage({ params }: Props) {
    const { id: bootcampId, lessonId } = use(params);
    const router = useRouter();

    const [lesson, setLesson] = useState<(Lesson & { bootcamps?: { title: string; slug: string } }) | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState({
        title: "",
        slug: "",
        learning_objective: "",
        duration_minutes: 5,
        content_type: "video" as "video" | "text" | "both",
        video_url: "",
        text_content: "",
        create_action_type: "guided_remix" as "prompt_template" | "template_pack" | "guided_remix",
        create_action_payload: {} as Record<string, any>,
        create_action_label: "Create Now",
        create_action_description: "",
        is_published: false,
    });

    // Multi-video state
    const [videos, setVideos] = useState<VideoItem[]>([]);

    useEffect(() => {
        fetchLesson();
    }, [lessonId]);

    async function fetchLesson() {
        try {
            const res = await fetch(`/api/cms/lessons/${lessonId}`);
            if (!res.ok) throw new Error("Failed to load Learning Flow");
            const data = await res.json();
            setLesson(data.lesson);
            setForm({
                title: data.lesson.title || "",
                slug: data.lesson.slug || "",
                learning_objective: data.lesson.learning_objective || "",
                duration_minutes: data.lesson.duration_minutes || 5,
                content_type: data.lesson.content_type || "video",
                video_url: data.lesson.video_url || "",
                text_content: data.lesson.text_content || "",
                create_action_type: data.lesson.create_action_type || "guided_remix",
                create_action_payload: data.lesson.create_action_payload || {},
                create_action_label: data.lesson.create_action_label || "Create Now",
                create_action_description: data.lesson.create_action_description || "",
                is_published: data.lesson.is_published || false,
            });

            // Fetch videos
            const vidRes = await fetch(`/api/cms/lesson-videos?lesson_id=${lessonId}`);
            if (vidRes.ok) {
                const vidData = await vidRes.json();
                setVideos(vidData.videos || []);
            }
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

    const handleTemplateSelect = (templateId: string | null) => {
        handleChange("create_action_payload", { ...form.create_action_payload, template_id: templateId });
    };

    const handleSave = async () => {
        setError(null);
        setSuccess(null);
        setSaving(true);

        try {
            // Calculate duration from videos
            const totalDuration = videos.length > 0
                ? Math.ceil(videos.reduce((sum, v) => sum + v.duration_seconds, 0) / 60)
                : form.duration_minutes;

            const res = await fetch(`/api/cms/lessons/${lessonId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    duration_minutes: totalDuration,
                    video_count: videos.length,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to save Learning Flow");
            }

            // Save videos
            await fetch("/api/cms/lesson-videos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lesson_id: lessonId,
                    videos,
                }),
            });

            setLesson(data.lesson);
            setSuccess("Learning Flow saved successfully!");

        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Delete this Learning Flow? This cannot be undone.")) return;

        try {
            const res = await fetch(`/api/cms/lessons/${lessonId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
            router.push(`/dashboard/cms/bootcamps/${bootcampId}`);
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20 text-white"><Loader2 className="animate-spin" /></div>;
    }

    if (!lesson) {
        return (
            <main className="mx-auto w-full max-w-3xl px-4 py-8 text-white">
                <p className="text-center text-white/60">Learning Flow not found</p>
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
                    <Link href={`/dashboard/cms/bootcamps/${bootcampId}`} className="hover:text-white">
                        {lesson.bootcamps?.title || "..."}
                    </Link>
                    <ChevronRight size={12} />
                    <span className="text-[#B7FF00]">Edit Learning Flow</span>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-3">
                            <Sparkles className="text-[#B7FF00]" />
                            Edit Learning Flow
                        </h1>
                        <p className="text-white/50 mt-1">Users see this as a "Mission"</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/learn/${lesson.bootcamps?.slug}/${lesson.slug}`}
                            target="_blank"
                            className="flex items-center gap-2 text-sm text-white/60 hover:text-white"
                        >
                            <Eye size={16} />
                            Preview
                        </Link>
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300"
                        >
                            <Trash2 size={16} />
                            Delete
                        </button>
                    </div>
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

            <div className="space-y-8">
                {/* Section: Basic Info */}
                <section className="space-y-4">
                    <h2 className="text-lg font-bold border-b border-white/10 pb-2">Basic Information</h2>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Title</label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => handleChange("title", e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white focus:border-[#B7FF00] focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Slug</label>
                            <input
                                type="text"
                                value={form.slug}
                                onChange={(e) => handleChange("slug", e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white focus:border-[#B7FF00] focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Learning Objective</label>
                        <input
                            type="text"
                            value={form.learning_objective}
                            onChange={(e) => handleChange("learning_objective", e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white focus:border-[#B7FF00] focus:outline-none"
                        />
                    </div>
                </section>

                {/* Section: Learn - Micro-Videos */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Play size={18} className="text-[#B7FF00]" />
                        <h2 className="text-lg font-bold">Learn</h2>
                        <span className="text-xs text-white/40">(Micro-Videos)</span>
                    </div>

                    <VideoManager
                        videos={videos}
                        onChange={setVideos}
                        minVideos={2}
                        maxVideos={5}
                    />

                    {/* Supporting text */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Supporting Text (optional)
                        </label>
                        <textarea
                            value={form.text_content}
                            onChange={(e) => handleChange("text_content", e.target.value)}
                            placeholder="Optional recap, checklist, or examples..."
                            rows={4}
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none resize-none"
                        />
                    </div>
                </section>

                {/* Section: Create Action */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Sparkles size={18} className="text-[#B7FF00]" />
                        <h2 className="text-lg font-bold">Create Action</h2>
                    </div>

                    {/* Template Selector */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Template</label>
                        <TemplateSelector
                            selectedTemplateId={form.create_action_payload.template_id || null}
                            onSelect={handleTemplateSelect}
                            visibilityFilter={["public", "learning_only"]}
                        />
                    </div>

                    {/* Action Type */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Action Type</label>
                        <div className="flex flex-wrap gap-2">
                            {["guided_remix", "prompt_template", "template_pack"].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => handleChange("create_action_type", type)}
                                    className={`px-3 py-1.5 rounded-lg border text-sm transition ${form.create_action_type === type
                                            ? "border-[#B7FF00] bg-[#B7FF00]/10 text-[#B7FF00]"
                                            : "border-white/10 text-white/60"
                                        }`}
                                >
                                    {type.replace(/_/g, " ")}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Button Label</label>
                            <input
                                type="text"
                                value={form.create_action_label}
                                onChange={(e) => handleChange("create_action_label", e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white focus:border-[#B7FF00] focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Description</label>
                            <input
                                type="text"
                                value={form.create_action_description}
                                onChange={(e) => handleChange("create_action_description", e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                            />
                        </div>
                    </div>
                </section>

                {/* Publish */}
                <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-zinc-900/50">
                    <input
                        type="checkbox"
                        id="is_published"
                        checked={form.is_published}
                        onChange={(e) => handleChange("is_published", e.target.checked)}
                        className="w-5 h-5 rounded border-white/20 bg-zinc-800 text-[#B7FF00]"
                    />
                    <label htmlFor="is_published">
                        <div className="font-medium">Published</div>
                        <div className="text-sm text-white/50">
                            Visible to users when bootcamp is published
                        </div>
                    </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <Link
                        href={`/dashboard/cms/bootcamps/${bootcampId}`}
                        className="flex items-center gap-2 text-white/60 hover:text-white transition"
                    >
                        <ArrowLeft size={18} />
                        Back to Bootcamp
                    </Link>

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
        </main>
    );
}
