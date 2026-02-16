"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import Loading from "@/components/Loading";
import {
    Plus, BookOpen, Edit, Trash2, Eye, EyeOff, Clock,
    MoreVertical, ChevronRight, Newspaper
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type BlogPost = {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    featured_image_url: string | null;
    is_published: boolean;
    published_at: string | null;
    created_at: string;
    author_id: string;
};

export default function BlogCMSPage() {
    const router = useRouter();
    const { user, initialized } = useAuth();
    const supabase = createSupabaseBrowserClient();

    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionMenu, setActionMenu] = useState<string | null>(null);

    useEffect(() => {
        if (initialized) {
            fetchPosts();
        }
    }, [initialized]);

    async function fetchPosts() {
        try {
            const { data, error } = await supabase
                .from("blog_posts")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setPosts(data || []);
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
                .from("blog_posts")
                .delete()
                .eq("id", id);

            if (error) throw error;
            setPosts(prev => prev.filter(p => p.id !== id));
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
        setActionMenu(null);
    }

    async function handleTogglePublish(post: BlogPost) {
        try {
            const updates = {
                is_published: !post.is_published,
                published_at: !post.is_published ? new Date().toISOString() : post.published_at
            };

            const { error } = await supabase
                .from("blog_posts")
                .update(updates)
                .eq("id", post.id);

            if (error) throw error;

            setPosts(prev => prev.map(p =>
                p.id === post.id ? { ...p, ...updates } : p
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
                        <span className="text-[#FFD93D]">Blog</span>
                    </div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <Newspaper className="text-[#FFD93D]" />
                        Blog Posts
                    </h1>
                </div>

                <Link
                    href="/dashboard/cms/blog/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#FFD93D] px-4 py-2.5 font-semibold text-black hover:bg-[#e6c22c] transition"
                >
                    <Plus size={18} />
                    New Post
                </Link>
            </div>

            {error && (
                <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}

            {/* Posts List */}
            {posts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 p-16 text-center">
                    <Newspaper size={48} className="mx-auto mb-4 text-white/20" />
                    <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                    <p className="text-white/50 mb-6">Create your first blog post to share updates.</p>
                    <Link
                        href="/dashboard/cms/blog/new"
                        className="inline-flex items-center gap-2 rounded-lg bg-[#FFD93D] px-4 py-2.5 font-semibold text-black hover:bg-[#e6c22c] transition"
                    >
                        <Plus size={18} />
                        Create Post
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {posts.map(post => (
                        <div
                            key={post.id}
                            className="group flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900/50 p-4 hover:border-white/20 transition"
                        >
                            {/* Thumbnail */}
                            <div className="w-20 h-14 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                                {post.featured_image_url ? (
                                    <img src={post.featured_image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/20">
                                        <Newspaper size={24} />
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Link
                                        href={`/dashboard/cms/blog/${post.id}`}
                                        className="font-semibold text-white hover:text-[#FFD93D] truncate"
                                    >
                                        {post.title}
                                    </Link>

                                    {/* Status badge */}
                                    {post.is_published ? (
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
                                </div>

                                <div className="flex items-center gap-4 text-xs text-white/40">
                                    <span className="flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(post.created_at).toLocaleDateString()}
                                    </span>
                                    <span>/{post.slug}</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/dashboard/cms/blog/${post.id}`}
                                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 transition"
                                >
                                    Edit
                                </Link>

                                <div className="relative">
                                    <button
                                        onClick={() => setActionMenu(actionMenu === post.id ? null : post.id)}
                                        className="p-2 rounded-lg hover:bg-white/10 transition"
                                    >
                                        <MoreVertical size={16} />
                                    </button>

                                    {actionMenu === post.id && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setActionMenu(null)}
                                            />
                                            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg bg-zinc-800 border border-white/10 shadow-xl py-1">
                                                <button
                                                    onClick={() => handleTogglePublish(post)}
                                                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 flex items-center gap-2"
                                                >
                                                    {post.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    {post.is_published ? "Unpublish" : "Publish"}
                                                </button>
                                                <hr className="my-1 border-white/10" />
                                                <button
                                                    onClick={() => handleDelete(post.id, post.title)}
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
