"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import Loading from "@/components/Loading";
import {
    ChevronRight, Save, ArrowLeft, Globe, Eye
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import ThumbnailUploader from "@/components/cms/ThumbnailUploader";

export default function BlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
    // Unwrap params using React.use()
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
        slug: "",
        excerpt: "",
        content: "",
        featured_image_url: "",
        is_published: false
    });

    useEffect(() => {
        if (!isNew && initialized) {
            fetchPost();
        }
    }, [id, initialized, isNew]);

    async function fetchPost() {
        try {
            const { data, error } = await supabase
                .from("blog_posts")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            if (data) {
                setFormData({
                    title: data.title || "",
                    slug: data.slug || "",
                    excerpt: data.excerpt || "",
                    content: data.content || "",
                    featured_image_url: data.featured_image_url || "",
                    is_published: data.is_published || false
                });
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function generateSlug(title: string) {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "");
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError(null);

        try {
            const slug = formData.slug || generateSlug(formData.title);

            const payload = {
                title: formData.title,
                slug,
                excerpt: formData.excerpt,
                content: formData.content,
                featured_image_url: formData.featured_image_url,
                is_published: formData.is_published,
                updated_at: new Date().toISOString()
            };

            if (isNew) {
                const { error } = await supabase
                    .from("blog_posts")
                    .insert([{ ...payload, author_id: user?.id }]);
                if (error) throw error;
                router.push("/dashboard/cms/blog");
            } else {
                const { error } = await supabase
                    .from("blog_posts")
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
                            <Link href="/dashboard/cms/blog" className="hover:text-white">Blog</Link>
                            <ChevronRight size={12} />
                            <span className="text-[#FFD93D]">{isNew ? "New Post" : "Edit Post"}</span>
                        </div>
                        <h1 className="text-2xl font-bold">
                            {isNew ? "Create Blog Post" : "Edit Blog Post"}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/dashboard/cms/blog"
                            className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 transition"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-lg bg-[#FFD93D] px-6 py-2.5 font-semibold text-black hover:bg-[#e6c22c] transition disabled:opacity-50"
                        >
                            {saving ? (
                                <span className="animate-spin duration-300">⟳</span>
                            ) : (
                                <Save size={18} />
                            )}
                            {saving ? "Saving..." : "Save Post"}
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
                                onChange={e => {
                                    const title = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        title,
                                        // Auto-generate slug if it's new or empty
                                        slug: isNew || !prev.slug ? generateSlug(title) : prev.slug
                                    }));
                                }}
                                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-lg font-medium focus:border-[#FFD93D] focus:outline-none"
                                placeholder="Post title..."
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-white/60">Content (Markdown)</label>
                            <textarea
                                value={formData.content}
                                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                                className="w-full h-[500px] rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 font-mono text-sm focus:border-[#FFD93D] focus:outline-none resize-none"
                                placeholder="# Write your post here..."
                            />
                            <p className="text-xs text-white/30 text-right">Supports Markdown formatting</p>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Publishing */}
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5 space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Globe size={18} className="text-[#FFD93D]" />
                                Publishing
                            </h3>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-white/60">Slug</label>
                                <input
                                    type="text"
                                    value={formData.slug}
                                    onChange={e => setFormData(prev => ({ ...prev, slug: generateSlug(e.target.value) }))}
                                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-[#FFD93D] focus:outline-none"
                                />
                            </div>

                            <label className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-black/20 cursor-pointer hover:bg-black/30 transition">
                                <input
                                    type="checkbox"
                                    checked={formData.is_published}
                                    onChange={e => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
                                    className="w-5 h-5 rounded border-white/20 bg-zinc-800 text-[#FFD93D] focus:ring-[#FFD93D]"
                                />
                                <span className="text-sm font-medium">Publish Post</span>
                            </label>
                        </div>

                        {/* Featured Image */}
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5 space-y-4">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Eye size={18} className="text-[#FFD93D]" />
                                Featured Image
                            </h3>

                            <ThumbnailUploader
                                currentUrl={formData.featured_image_url}
                                onUpload={(url) => setFormData(prev => ({ ...prev, featured_image_url: url }))}
                                bucket="bootcamp-assets"
                                folder="blog"
                            />
                        </div>

                        {/* Excerpt */}
                        <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-5 space-y-4">
                            <h3 className="font-semibold text-sm">Excerpt</h3>
                            <textarea
                                value={formData.excerpt}
                                onChange={e => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
                                className="w-full h-32 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm focus:border-[#FFD93D] focus:outline-none resize-none"
                                placeholder="Brief summary..."
                            />
                        </div>
                    </div>
                </div>
            </form>
        </main>
    );
}
