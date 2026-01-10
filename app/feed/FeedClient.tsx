"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { ArrowBigUp, Heart, RefreshCw, Clock, TrendingUp, User } from "lucide-react";
import Loading from "@/components/Loading";
import GenerationLightbox from "@/components/GenerationLightbox";
import { useToast } from "@/context/ToastContext";

export type FeedItem = {
    id: string; // generation id
    imageUrl: string;
    createdAt: string;
    upvotesCount: number;
    isLiked: boolean; // has current user upvoted? (Upvote status)
    isSaved: boolean; // has current user saved/favorited?
    userId: string;
    username: string;
    userAvatar: string | null;
    promptTitle: string;
    originalPromptText: string;
    remixPromptText: string;
    combinedPromptText: string;
    fullQualityUrl?: string | null;
};

type FeedClientProps = {
    initialItems: FeedItem[];
};

export default function FeedClient({ initialItems }: FeedClientProps) {
    const router = useRouter();
    // Initialize with server data
    const [items, setItems] = useState<FeedItem[]>(initialItems);
    // If we have initial items, we are not loading initially.
    const [loading, setLoading] = useState(initialItems.length === 0);
    const [sort, setSort] = useState<"newest" | "trending">("newest");
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true); // Assume more unless initial fetch was empty? 
    // Actually if initialItems < 8, we know there's no more.

    // We need to track if we've done the client-side mount fetch or if we rely on initial.
    // Ideally: Page 0 is provided. We only fetch if Page > 0 OR Sort changes.
    const mountedRef = useRef(false);

    const { showToast } = useToast();
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
        if (!mountedRef.current) {
            mountedRef.current = true;
            // On first mount, if we have initialItems and page is 0 and sort is newest, do NOTHING.
            // But we must check hasMore status based on initial count.
            if (initialItems.length < 8) setHasMore(false);
            return;
        }

        // Reset on sort change
        // State update for sort causes re-render, then this effect runs.
        // Wait, we need to distinguish between Sort Change and Page Change.
        // If sort changed, we reset items.
    }, []);

    // Handling Sort Changes
    useEffect(() => {
        if (mountedRef.current) {
            // If we are just mounting, we don't want to wipe initialItems.
            // But 'sort' changes on user interaction.
            // Actually, initial state uses default sort "newest".
            // If user clicks "trending", sort changes -> reset items -> fetch.
        }
    }, [sort]);

    // Combined fetch logic
    const fetchFeed = async (isReset: boolean = false) => {
        setLoading(true);
        try {
            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            // Don't force redirect here on client fetch, maybe user is exploring? 
            // Although page requires auth generally.

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

            const userIds = Array.from(new Set(data.map((d: any) => d.user_id)));
            let profileMap = new Map();
            if (userIds.length > 0) {
                const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, profile_image").in("user_id", userIds);
                profiles?.forEach((p: any) => profileMap.set(p.user_id, p));
            }

            // Upvotes/Saved
            let myUpvotedSet = new Set();
            let mySavedSet = new Set();
            if (user) {
                const genIds = data.map((d: any) => d.id);
                if (genIds.length > 0) {
                    const { data: myUpvotes } = await supabase.from("remix_upvotes").select("generation_id").eq("user_id", user.id).in("generation_id", genIds);
                    myUpvotedSet = new Set(myUpvotes?.map((u: any) => u.generation_id));
                    const { data: mySaved } = await supabase.from("prompt_favorites").select("generation_id").eq("user_id", user.id).in("generation_id", genIds);
                    mySavedSet = new Set(mySaved?.map((u: any) => u.generation_id));
                }
            }

            const newItems: FeedItem[] = data.map((d: any) => {
                const profile = profileMap.get(d.user_id) || {};
                const settings = d.settings || {};
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
                    fullQualityUrl: settings.full_quality_url || null,
                };
            });

            setItems(prev => (isReset ? newItems : [...prev, ...newItems]));
        } finally {
            setLoading(false);
        }
    };

    // Effect for Page/Sort
    useEffect(() => {
        // Skip first load if we have items and page is 0 and sort is newest
        if (!mountedRef.current) return;

        // If page is 0 and items exist matching current sort... 
        // This logic is tricky. Simplification:
        // When Sort changes -> Reset items, Page=0.
        // When Page changes -> Fetch append.

        // This effect runs on [page, sort]. 
        // We need to differentiate "Initial Mount" vs "Updates".
        // Initial Mount (page 0, sort newest) => Handled by initialProps.

        if (page === 0 && sort === "newest" && items.length > 0 && items[0] === initialItems[0]) {
            // Probably initial load or just reset to same state.
            // Don't refetch.
            return;
        }

        const isReset = page === 0;
        if (isReset) setItems([]);
        // But if isReset, we might want to show loading skeleton?

        fetchFeed(isReset);

    }, [page, sort]);

    // Handle Sort Click
    const handleSort = (s: "newest" | "trending") => {
        if (s === sort) return;
        setSort(s);
        setPage(0);
        setHasMore(true);
        setItems([]);
    };

    // Actions (Upvote, Save, Remix, Lightbox) - Copied from page.tsx logic
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
        const wasSaved = item.isSaved;
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, isSaved: !wasSaved } : i));

        if (!wasSaved) showToast("Saved to Favorites!");
        else showToast("Removed from Favorites");

        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let error;
        if (wasSaved) {
            const { error: err } = await supabase.from("prompt_favorites").delete().match({ user_id: user.id, generation_id: item.id });
            error = err;
        } else {
            const { error: err } = await supabase.from("prompt_favorites").insert({ user_id: user.id, generation_id: item.id });
            error = err;
        }

        if (error) {
            showToast("Failed to save: " + error.message, "error");
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isSaved: wasSaved } : i));
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
                        onClick={() => handleSort("newest")}
                        className={`px-4 py-1.5 text-xs font-bold uppercase rounded flex items-center gap-2 ${sort === "newest" ? "bg-[#B7FF00] text-black" : "text-white/50 hover:text-white"}`}
                    >
                        <Clock size={12} /> Newest
                    </button>
                    <button
                        onClick={() => handleSort("trending")}
                        className={`px-4 py-1.5 text-xs font-bold uppercase rounded flex items-center gap-2 ${sort === "trending" ? "bg-[#B7FF00] text-black" : "text-white/50 hover:text-white"}`}
                    >
                        <TrendingUp size={12} /> Trending
                    </button>
                </div>
            </div>

            <div className="space-y-12">
                {items.map((item, index) => (
                    <article ref={index === items.length - 1 ? lastElementRef : null} key={`${item.id}-${index}`} className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
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

                        <div className="relative aspect-square sm:aspect-video w-full bg-black cursor-pointer group" onClick={() => openLightbox(item)}>
                            {/* Guard image rendering */}
                            {item.imageUrl ? (
                                <Image
                                    src={item.imageUrl}
                                    alt={item.promptTitle}
                                    fill
                                    className="object-contain sm:object-cover"
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 896px"
                                    loading={index < 2 ? "eager" : "lazy"} // Eager load first 2
                                />
                            ) : (
                                <div className="h-full w-full bg-zinc-900 flex items-center justify-center text-white/20">Processing...</div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>

                        <div className="p-4 flex items-center justify-between bg-zinc-900">
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={() => handleUpvote(item)}
                                    className={`flex items-center gap-2 text-sm font-bold transition group ${item.isLiked ? "text-[#B7FF00]" : "text-white/60 hover:text-white"}`}
                                >
                                    <ArrowBigUp size={24} fill={item.isLiked ? "currentColor" : "none"} className={`transition-transform group-active:scale-125 ${item.isLiked ? "scale-110" : ""}`} />
                                    <span>{item.upvotesCount}</span>
                                </button>

                                <button
                                    onClick={() => handleSave(item)}
                                    className={`flex items-center gap-2 text-sm font-bold transition group ${item.isSaved ? "text-pink-500" : "text-white/60 hover:text-white"}`}
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
                    onShare={() => { }}
                    onRemix={handleRemix}
                    title={selectedItem.promptTitle}
                    fullQualityUrl={selectedItem.fullQualityUrl}
                />
            )}
        </main>
    );
}
