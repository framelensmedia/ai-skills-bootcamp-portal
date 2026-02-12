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
// Import the new manager/builder
import LessonContentManager, { LessonContentItem } from "@/components/cms/LessonContentManager";

type Props = {
    params: Promise<{ id: string; lessonId: string }>;
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
        content_type: "mixed" as "video" | "text" | "both" | "mixed",
        video_url: "",
        text_content: "",
        create_action_type: "guided_remix" as "prompt_template" | "template_pack" | "guided_remix",
        create_action_payload: {} as Record<string, any>,
        create_action_label: "Create Now",
        create_action_description: "",
        is_published: false,
    });

    // Multi-content state (Replaces 'videos')
    const [contentItems, setContentItems] = useState<LessonContentItem[]>([]);

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
                content_type: data.lesson.content_type || "mixed",
                video_url: data.lesson.video_url || "",
                text_content: data.lesson.text_content || "",
                create_action_type: data.lesson.create_action_type || "guided_remix",
                create_action_payload: data.lesson.create_action_payload || {},
                create_action_label: data.lesson.create_action_label || "Create Now",
                create_action_description: data.lesson.create_action_description || "",
                is_published: data.lesson.is_published || false,
            });

            // Fetch mixed content items
            // First try fetching content items
            const contentRes = await fetch(`/api/cms/lesson-contents?lesson_id=${lessonId}`);
            if (contentRes.ok) {
                const contentData = await contentRes.json();
                if (contentData.contents && contentData.contents.length > 0) {
                    setContentItems(contentData.contents);
                    return;
                }
            }

            // Fallback: Check for legacy videos if no content items found
            const vidRes = await fetch(`/api/cms/lesson-videos?lesson_id=${lessonId}`);
            if (vidRes.ok) {
                const vidData = await vidRes.json();
                if (vidData.videos && vidData.videos.length > 0) {
                    // Convert legacy videos to new format
                    const converted: LessonContentItem[] = vidData.videos.map((v: any) => ({
                        id: v.id, // Preserve ID if possible or let new system handle
                        type: 'video',
                        title: v.title,
                        order_index: v.order_index,
                        content: {
                            video_url: v.video_url,
                            duration_seconds: v.duration_seconds,
                            thumbnail_url: v.thumbnail_url
                        },
                        is_published: v.is_published
                    }));
                    setContentItems(converted);
                }
            }

        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const handleChange = (field: string, value: any) => {
        setForm(prev => {
            const updates = { ...prev, [field]: value };

            // Smart Slug Sync: If slug matches the *previous* title (is synced), update it
            if (field === "title") {
                const currentSlug = prev.slug;
                const expectedSlug = prev.title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "");

                // If they match (or slug is empty), keep them synced
                if (currentSlug === expectedSlug || !currentSlug) {
                    updates.slug = value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, "");
                }
            }

            return updates;
        });
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
            // Calculate duration from content items
            const totalDuration = contentItems.length > 0
                ? Math.ceil(contentItems.reduce((sum, item) => sum + (item.content.duration_seconds || 60), 0) / 60)
                : form.duration_minutes;

            // Sync "Create Action" (exercise) item to top-level lesson fields
            // This ensures the "Your Mission" section matches the builder content
            const actionItem = contentItems.find(i => i.type === 'exercise');
            const lessonUpdates = {
                ...form,
                duration_minutes: totalDuration,
                content_count: contentItems.length,
            };

            if (actionItem) {
                // Map exercise content to create_action fields
                lessonUpdates.create_action_type = "guided_remix"; // Default to guided remix for builder actions
                lessonUpdates.create_action_label = actionItem.content.description || "Create Now";
                lessonUpdates.create_action_description = actionItem.title || "Put what you learned into action";

                // If template selected (stored in explanation field in builder)
                if (actionItem.content.explanation) {
                    lessonUpdates.create_action_payload = {
                        ...form.create_action_payload,
                        template_id: actionItem.content.explanation
                    };
                }
            }

            const res = await fetch(`/api/cms/lessons/${lessonId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(lessonUpdates),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to save Learning Flow");
            }

            // Save content items
            const contentSaveRes = await fetch("/api/cms/lesson-contents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    lesson_id: lessonId,
                    contents: contentItems,
                }),
            });

            if (!contentSaveRes.ok) {
                const errorData = await contentSaveRes.json();
                throw new Error("Failed to save content items: " + (errorData.error || contentSaveRes.statusText));
            }

            setLesson(data.lesson);
            setSuccess("Learning Flow saved successfully!");

        } catch (e: any) {
            console.error(e);
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

                {/* Section: Learn - Content Items */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Play size={18} className="text-[#B7FF00]" />
                        <h2 className="text-lg font-bold">Learn</h2>
                        <span className="text-xs text-white/40">(Videos, Exercises & More)</span>
                    </div>

                    <LessonContentManager
                        items={contentItems}
                        onChange={setContentItems}
                    />

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
