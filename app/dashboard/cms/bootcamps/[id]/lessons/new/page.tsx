"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft, Save, Loader2, BookOpen, ChevronRight,
    Video, FileText, Sparkles, Play
} from "lucide-react";
import type { Bootcamp } from "@/lib/types/learning-flow";
import TemplateSelector from "@/components/cms/TemplateSelector";
import LessonContentManager, { LessonContentItem } from "@/components/cms/LessonContentManager";

type Props = {
    params: Promise<{ id: string }>;
};

export default function NewLearningFlowPage({ params }: Props) {
    console.log("NewLearningFlowPage rendering");
    const { id: bootcampId } = use(params);
    const router = useRouter();

    const [bootcamp, setBootcamp] = useState<Bootcamp | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [form, setForm] = useState({
        title: "",
        slug: "",
        learning_objective: "",
        duration_minutes: 5,
        content_type: "mixed" as "video" | "text" | "both" | "mixed",
        video_url: "", // Legacy single video
        text_content: "",
        create_action_type: "guided_remix" as "prompt_template" | "template_pack" | "guided_remix",
        create_action_payload: {} as Record<string, any>,
        create_action_label: "Create Now",
        create_action_description: "",
        is_published: false,
    });

    // Multi-content state
    const [contentItems, setContentItems] = useState<LessonContentItem[]>([]);

    useEffect(() => {
        fetchBootcamp();
    }, [bootcampId]);

    async function fetchBootcamp() {
        try {
            const res = await fetch(`/api/cms/bootcamps/${bootcampId}`);
            if (!res.ok) throw new Error("Failed to load bootcamp");
            const data = await res.json();
            setBootcamp(data.bootcamp);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const handleChange = (field: string, value: any) => {
        setForm(prev => {
            const updates = { ...prev, [field]: value };

            // Smart Slug Sync
            if (field === "title") {
                const currentSlug = prev.slug;
                const expectedSlug = prev.title
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/(^-|-$)/g, "");

                // If they match (or slug is empty), update slug
                if (currentSlug === expectedSlug || !currentSlug) {
                    updates.slug = value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, "");
                }
            }

            return updates;
        });
    };

    const handleTemplateSelect = (templateId: string | null) => {
        handleChange("create_action_payload", { template_id: templateId });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        try {
            // Calculate duration from content items
            const totalDuration = contentItems.length > 0
                ? Math.ceil(contentItems.reduce((sum, item) => sum + (item.content.duration_seconds || 60), 0) / 60)
                : form.duration_minutes;

            const res = await fetch("/api/cms/lessons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    bootcamp_id: bootcampId,
                    duration_minutes: totalDuration,
                    content_count: contentItems.length,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to create Learning Flow");
            }

            // Save content items if any
            if (contentItems.length > 0) {
                const contentRes = await fetch("/api/cms/lesson-contents", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lesson_id: data.lesson.id,
                        contents: contentItems,
                    }),
                });

                if (!contentRes.ok) {
                    const errorData = await contentRes.json();
                    throw new Error("Failed to save content items: " + (errorData.error || contentRes.statusText));
                }
            }

            router.push(`/dashboard/cms/bootcamps/${bootcampId}`);

        } catch (e: any) {
            setError(e.message);
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center py-20 text-white"><Loader2 className="animate-spin" /></div>;
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
                        {bootcamp?.title || "..."}
                    </Link>
                    <ChevronRight size={12} />
                    <span className="text-[#B7FF00]">New Learning Flow</span>
                </div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <Sparkles className="text-[#B7FF00]" />
                    Create Learning Flow
                </h1>
                <p className="text-white/50 mt-1">
                    Learning Flows appear as "Missions" to users
                </p>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Section: Basic Info */}
                <section className="space-y-4">
                    <h2 className="text-lg font-bold border-b border-white/10 pb-2">Basic Information</h2>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                Title <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => handleChange("title", e.target.value)}
                                placeholder="e.g., Create Your First AI Image"
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Slug</label>
                            <input
                                type="text"
                                value={form.slug}
                                onChange={(e) => handleChange("slug", e.target.value)}
                                placeholder="first-ai-image"
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Learning Objective <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.learning_objective}
                            onChange={(e) => handleChange("learning_objective", e.target.value)}
                            placeholder="What will the user be able to do after this mission?"
                            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                            required
                        />
                        <p className="mt-1 text-xs text-white/40">
                            Shown as "Goal: [objective]" at the top of the mission
                        </p>
                    </div>
                </section>

                {/* Section: Learn - Content Items */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                        <Play size={18} className="text-[#B7FF00]" />
                        <h2 className="text-lg font-bold">Learn</h2>
                        <span className="text-xs text-white/40">(Videos & Exercises)</span>
                    </div>

                    <LessonContentManager
                        items={contentItems}
                        onChange={setContentItems}
                    />

                </section>

                {/* Publish Toggle */}
                <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-zinc-900/50">
                    <input
                        type="checkbox"
                        id="is_published"
                        checked={form.is_published}
                        onChange={(e) => handleChange("is_published", e.target.checked)}
                        className="w-5 h-5 rounded border-white/20 bg-zinc-800 text-[#B7FF00]"
                    />
                    <label htmlFor="is_published" className="flex-1">
                        <div className="font-medium">Publish immediately</div>
                        <div className="text-sm text-white/50">
                            Learning Flow will be visible when bootcamp is published
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
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        disabled={saving || !form.title.trim() || !form.learning_objective.trim()}
                        className="flex items-center gap-2 rounded-lg bg-[#B7FF00] px-6 py-2.5 font-semibold text-black hover:bg-[#a3e600] disabled:opacity-50 transition"
                    >
                        {saving ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Creating...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Create Learning Flow
                            </>
                        )}
                    </button>
                </div>
            </form>
        </main>
    );
}
