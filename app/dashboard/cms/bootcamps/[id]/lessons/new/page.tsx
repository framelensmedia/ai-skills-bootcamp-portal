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
import VideoManager from "@/components/cms/VideoManager";

type Props = {
    params: Promise<{ id: string }>;
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

export default function NewLearningFlowPage({ params }: Props) {
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
        content_type: "video" as "video" | "text" | "both",
        video_url: "", // Legacy single video
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
        setForm(prev => ({ ...prev, [field]: value }));

        // Auto-generate slug from title
        if (field === "title" && !form.slug) {
            const slug = value.toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/(^-|-$)/g, "");
            setForm(prev => ({ ...prev, slug }));
        }
    };

    const handleTemplateSelect = (templateId: string | null) => {
        handleChange("create_action_payload", { template_id: templateId });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        try {
            // Calculate duration from videos
            const totalDuration = videos.length > 0
                ? Math.ceil(videos.reduce((sum, v) => sum + v.duration_seconds, 0) / 60)
                : form.duration_minutes;

            const res = await fetch("/api/cms/lessons", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    bootcamp_id: bootcampId,
                    duration_minutes: totalDuration,
                    video_count: videos.length,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to create Learning Flow");
            }

            // Save videos if any
            if (videos.length > 0) {
                await fetch("/api/cms/lesson-videos", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lesson_id: data.lesson.id,
                        videos,
                    }),
                });
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

                    {/* Optional supporting text */}
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
                        <label className="block text-sm font-medium text-white/70 mb-2">
                            Template <span className="text-red-400">*</span>
                        </label>
                        <TemplateSelector
                            selectedTemplateId={form.create_action_payload.template_id || null}
                            onSelect={handleTemplateSelect}
                            visibilityFilter={["public", "learning_only"]}
                        />
                        <p className="mt-2 text-xs text-white/40">
                            Select a template for users to remix. Learning-only templates are hidden from public Studio.
                        </p>
                    </div>

                    {/* Action Type */}
                    <div>
                        <label className="block text-sm font-medium text-white/70 mb-2">Action Type</label>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { value: "guided_remix", label: "Guided Remix", desc: "Recommended" },
                                { value: "prompt_template", label: "Direct Template" },
                                { value: "template_pack", label: "Template Pack" },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleChange("create_action_type", opt.value)}
                                    className={`px-4 py-2 rounded-lg border text-sm transition ${form.create_action_type === opt.value
                                            ? "border-[#B7FF00] bg-[#B7FF00]/10 text-[#B7FF00]"
                                            : "border-white/10 text-white/60 hover:border-white/20"
                                        }`}
                                >
                                    {opt.label}
                                    {opt.desc && <span className="ml-1 text-[10px] opacity-60">({opt.desc})</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Button Label */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Button Label</label>
                            <input
                                type="text"
                                value={form.create_action_label}
                                onChange={(e) => handleChange("create_action_label", e.target.value)}
                                placeholder="Create Now"
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">Description (optional)</label>
                            <input
                                type="text"
                                value={form.create_action_description}
                                onChange={(e) => handleChange("create_action_description", e.target.value)}
                                placeholder="Additional context for the user"
                                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                            />
                        </div>
                    </div>
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
