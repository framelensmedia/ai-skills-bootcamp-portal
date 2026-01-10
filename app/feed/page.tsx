"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { ArrowBigUp, Heart, RefreshCw, Clock, TrendingUp, User, Bookmark } from "lucide-react";
import Loading from "@/components/Loading";
import GenerationLightbox from "@/components/GenerationLightbox";
import { useToast } from "@/context/ToastContext";

type FeedItem = {
    id: string; // generation id
    imageUrl: string;
    createdAt: string;
    upvotesCount: number;
    isLiked: boolean; // has current user upvoted? (Upvote status)
    isSaved: boolean; // has current user saved/favorited?

    // User info
    userId: string;
    username: string;
    userAvatar: string | null;

    // Prompt info
    promptTitle: string;
    originalPromptText: string;
    remixPromptText: string;
    combinedPromptText: string;
};

export default function RemixFeedPage() {
    const router = useRouter();
    const [items, setItems] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState<"newest" | "trending">("newest");
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);

    const { showToast } = useToast();

    // Lightbox state
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);

    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // Fetch Feed
    useEffect(() => {
        // Reset on sort change
        setItems([]);
        setPage(0);
        setHasMore(true);
        setLoading(true);
    }, [sort]);

    useEffect(() => {
        const fetchFeed = async () => {
            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/login?redirect=/feed");
                return;
            }

            // Base Query
            let q = supabase
                .from("prompt_generations")
                .select(`
                id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text, is_public,
                user_id
            `)
                .eq("is_public", true)
                .range(page * 8, (page + 1) * 8 - 1);

            if (sort === "newest") {
                q = q.order("created_at", { ascending: false });
            } else {
                q = q.order("upvotes_count", { ascending: false }).order("created_at", { ascending: false });
            }

            const { data, error } = await q;

            if (error) {
                console.error(error);
                setLoading(false);
                return;
            }

            if (data.length < 8) setHasMore(false);

            // Fetch User Profiles (manual join)
            const userIds = Array.from(new Set(data.map(d => d.user_id)));
            let profileMap = new Map();
            if (userIds.length > 0) {
                const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, profile_image").in("user_id", userIds);
                profiles?.forEach(p => profileMap.set(p.user_id, p));
            }

            // Check Upvotes status
            const genIds = data.map(d => d.id);
            const { data: myUpvotes } = await supabase.from("remix_upvotes").select("generation_id").eq("user_id", user.id).in("generation_id", genIds);
            const myUpvotedSet = new Set(myUpvotes?.map(u => u.generation_id));

            // Check Saved status
            const { data: mySaved } = await supabase.from("prompt_favorites").select("generation_id").eq("user_id", user.id).in("generation_id", genIds);
            const mySavedSet = new Set(mySaved?.map(u => u.generation_id));

            const newItems: FeedItem[] = data.map(d => {
                const profile = profileMap.get(d.user_id) || {};
                const settings = d.settings || {};
                // Resolve prompt texts
                const original = d.original_prompt_text || settings.original_prompt_text || "";
                const remix = d.remix_prompt_text || settings.remix_prompt_text || "";
                const combined = d.combined_prompt_text || settings.combined_prompt_text || "";

                return {
                    id: d.id,
                    imageUrl: d.image_url,
                    createdAt: d.created_at,
                    upvotesCount: d.upvotes_count || 0,
                    isLiked: myUpvotedSet.has(d.id),
                    isSaved: mySavedSet.has(d.id),
                    userId: d.user_id,
                    username: profile.full_name || "Anonymous Creator",
                    userAvatar: profile.profile_image || null,
                    promptTitle: settings.headline || "Untitled Remix",
                    originalPromptText: original,
                    remixPromptText: remix,
                    combinedPromptText: combined,
                };
            });

            setItems(prev => (page === 0 ? newItems : [...prev, ...newItems]));
            setLoading(false);
        };

        fetchFeed();
    }, [page, sort]);

    // Actions
    const handleUpvote = async (item: FeedItem) => {
        // Optimistic
        const wasLiked = item.isLiked;
        setItems(prev => prev.map(i => i.id === item.id ? {
            ...i,
            isLiked: !wasLiked,
            upvotesCount: i.upvotesCount + (wasLiked ? -1 : 1)
        } : i));

        if (!wasLiked) showToast("Upvoted!");

        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (wasLiked) {
            await supabase.from("remix_upvotes").delete().match({ user_id: user.id, generation_id: item.id });
        } else {
            await supabase.from("remix_upvotes").insert({ user_id: user.id, generation_id: item.id });
        }
    };

    const handleSave = async (item: FeedItem) => {
        // Optimistic
        const wasSaved = item.isSaved;
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isSaved: !wasSaved } : i));

        if (!wasSaved) showToast("Saved to Favorites!");
        else showToast("Removed from Favorites");

        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (wasSaved) {
            // Find and delete. We need to match generation_id.
            // Since we don't have the record ID easily, we delete by match
            await supabase.from("prompt_favorites").delete().match({ user_id: user.id, generation_id: item.id });
        } else {
            // Insert
            await supabase.from("prompt_favorites").insert({ user_id: user.id, generation_id: item.id, type: 'generation' });
        }
    };

    const openLightbox = (item: FeedItem) => {
        setSelectedItem(item);
        setLightboxOpen(true);
    };

    const handleRemix = (payload: any) => {
        const href = `/studio?img=${encodeURIComponent(payload.imgUrl)}` +
            `&remix=${encodeURIComponent(payload.remixPromptText || "")}`;
        router.push(href);
    };

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 text-white font-sans pb-32 relative">

            <div className="mb-8 border-b border-white/10 pb-6 flex flex-col md:flex-row gap-4 md:items-end md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Community Feed</h1>
                    <div className="flex items-center gap-2 text-sm text-white/50 font-mono uppercase tracking-wide">
                        <span>Discover what others are creating</span>
                    </div>
                </div>
                <div className="flex bg-zinc-900 p-1 rounded-lg self-start">
                    <button
                        onClick={() => setSort("newest")}
                        className={`px-4 py-1.5 text-xs font-bold uppercase rounded flex items-center gap-2 ${sort === "newest" ? "bg-[#B7FF00] text-black" : "text-white/50 hover:text-white"}`}
                    >
                        <Clock size={12} /> Newest
                    </button>
                    <button
                        onClick={() => setSort("trending")}
                        className={`px-4 py-1.5 text-xs font-bold uppercase rounded flex items-center gap-2 ${sort === "trending" ? "bg-[#B7FF00] text-black" : "text-white/50 hover:text-white"}`}
                    >
                        <TrendingUp size={12} /> Trending
                    </button>
                </div>
            </div>

            <div className="space-y-12">
                {items.map((item, index) => (
                    <article ref={index === items.length - 1 ? lastElementRef : null} key={`${item.id}-${index}`} className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
                        {/* Header */}
                        <div className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden relative">
                                {item.userAvatar ? (
                                    <Image src={item.userAvatar} fill className="object-cover" alt={item.username} />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-white/20"><User size={20} /></div>
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-bold text-white">{item.username}</div>
                                <div className="text-xs text-white/40">{new Date(item.createdAt).toLocaleDateString()} • {item.promptTitle}</div>
                            </div>
                        </div>

                        {/* Image */}
                        <div className="relative aspect-square sm:aspect-video w-full bg-black cursor-pointer group" onClick={() => openLightbox(item)}>
                            <Image
                                src={item.imageUrl}
                                alt={item.promptTitle}
                                fill
                                className="object-contain sm:object-cover"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 896px"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>

                        {/* Actions */}
                        <div className="p-4 flex items-center justify-between bg-zinc-900">
                            <div className="flex items-center gap-6">
                                {/* Upvote Button (Arrow) */}
                                <button
                                    onClick={() => handleUpvote(item)}
                                    className={`flex items-center gap-2 text-sm font-bold transition group ${item.isLiked ? "text-[#B7FF00]" : "text-white/60 hover:text-white"}`}
                                    title="Upvote"
                                >
                                    <ArrowBigUp size={24} fill={item.isLiked ? "currentColor" : "none"} className={`transition-transform group-active:scale-125 ${item.isLiked ? "scale-110" : ""}`} />
                                    <span>{item.upvotesCount}</span>
                                </button>

                                {/* Save Button (Heart) */}
                                <button
                                    onClick={() => handleSave(item)}
                                    className={`flex items-center gap-2 text-sm font-bold transition group ${item.isSaved ? "text-pink-500" : "text-white/60 hover:text-white"}`}
                                    title={item.isSaved ? "Saved to Library" : "Save to Favorites"}
                                >
                                    <Heart size={20} fill={item.isSaved ? "currentColor" : "none"} className="transition-transform group-active:scale-90" />
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    handleRemix({
                                        imgUrl: item.imageUrl,
                                        remixPromptText: item.remixPromptText,
                                        originalPromptText: item.originalPromptText,
                                        combinedPromptText: item.combinedPromptText
                                    })
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-[#B7FF00] text-black rounded-lg text-sm font-bold hover:bg-[#a3e600] transition"
                            >
                                <RefreshCw size={16} />
                                Remix This
                            </button>
                        </div>
                    </article>
                ))}

                {loading && (
                    <div className="py-12 flex justify-center">
                        <Loading />
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="text-center py-20 text-white/40">
                        No public remixes yet. Be the first to share one!
                    </div>
                )}
            </div>

            {selectedItem && (
                <GenerationLightbox
                    open={lightboxOpen}
                    url={selectedItem.imageUrl}
                    onClose={() => setLightboxOpen(false)}
                    originalPromptText={selectedItem.originalPromptText}
                    remixPromptText={selectedItem.remixPromptText}
                    combinedPromptText={selectedItem.combinedPromptText}
                    onShare={() => { }} // TODO implement share
                    onRemix={handleRemix}
                    title={selectedItem.promptTitle}
                />
            )}
        </main>
    );
}
