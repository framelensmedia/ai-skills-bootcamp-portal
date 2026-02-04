"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2, GraduationCap, ChevronRight } from "lucide-react";
import ThumbnailUploader from "@/components/cms/ThumbnailUploader";

export default function NewBootcampPage() {
    const router = useRouter();

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        title: "",
        slug: "",
        description: "",
        thumbnail_url: "",
        access_level: "free",
        is_published: false,
    });

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        try {
            const res = await fetch("/api/cms/bootcamps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to create bootcamp");
            }

            // Redirect to edit page to add lessons
            router.push(`/dashboard/cms/bootcamps/${data.bootcamp.id}`);

        } catch (e: any) {
            setError(e.message);
            setSaving(false);
        }
    };

    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-8 text-white font-sans">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-2">
                    <Link href="/dashboard/cms" className="hover:text-white">CMS</Link>
                    <ChevronRight size={12} />
                    <Link href="/dashboard/cms/bootcamps" className="hover:text-white">Bootcamps</Link>
                    <ChevronRight size={12} />
                    <span className="text-[#B7FF00]">New</span>
                </div>
                <h1 className="text-2xl font-bold flex items-center gap-3">
                    <GraduationCap className="text-[#B7FF00]" />
                    Create New Bootcamp
                </h1>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        Title <span className="text-red-400">*</span>
                    </label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={(e) => handleChange("title", e.target.value)}
                        placeholder="e.g., AI Content Mastery"
                        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                        required
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
                            placeholder="ai-content-mastery"
                            className="flex-1 rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none"
                        />
                    </div>
                    <p className="mt-1 text-xs text-white/40">
                        Leave empty to auto-generate from title
                    </p>
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        Description
                    </label>
                    <textarea
                        value={form.description}
                        onChange={(e) => handleChange("description", e.target.value)}
                        placeholder="What will users learn in this bootcamp?"
                        rows={3}
                        className="w-full rounded-lg border border-white/10 bg-zinc-900 px-4 py-3 text-white placeholder:text-white/30 focus:border-[#B7FF00] focus:outline-none resize-none"
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

                {/* Access Level */}
                <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                        Access Level
                    </label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => handleChange("access_level", "free")}
                            className={`px-4 py-2 rounded-lg border transition ${form.access_level === "free"
                                ? "border-[#B7FF00] bg-[#B7FF00]/10 text-[#B7FF00]"
                                : "border-white/10 text-white/60 hover:border-white/20"
                                }`}
                        >
                            Free
                        </button>
                        <button
                            type="button"
                            onClick={() => handleChange("access_level", "premium")}
                            className={`px-4 py-2 rounded-lg border transition ${form.access_level === "premium"
                                ? "border-amber-500 bg-amber-500/10 text-amber-400"
                                : "border-white/10 text-white/60 hover:border-white/20"
                                }`}
                        >
                            Premium
                        </button>
                    </div>
                </div>

                {/* Publish Status */}
                <div className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-zinc-900/50">
                    <input
                        type="checkbox"
                        id="is_published"
                        checked={form.is_published}
                        onChange={(e) => handleChange("is_published", e.target.checked)}
                        className="w-5 h-5 rounded border-white/20 bg-zinc-800 text-[#B7FF00] focus:ring-[#B7FF00] focus:ring-offset-0"
                    />
                    <label htmlFor="is_published" className="flex-1">
                        <div className="font-medium">Publish immediately</div>
                        <div className="text-sm text-white/50">
                            If unchecked, bootcamp will be saved as draft
                        </div>
                    </label>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-6 border-t border-white/10">
                    <Link
                        href="/dashboard/cms/bootcamps"
                        className="flex items-center gap-2 text-white/60 hover:text-white transition"
                    >
                        <ArrowLeft size={18} />
                        Cancel
                    </Link>

                    <button
                        type="submit"
                        disabled={saving || !form.title.trim()}
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
                                Create Bootcamp
                            </>
                        )}
                    </button>
                </div>
            </form>
        </main>
    );
}
