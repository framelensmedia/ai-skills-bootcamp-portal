"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { ArrowBigUp, Heart, RefreshCw, Clock, TrendingUp, User } from "lucide-react";
import Loading from "@/components/Loading";
import GenerationLightbox from "@/components/GenerationLightbox";
import VideoGeneratorModal from "@/components/VideoGeneratorModal";
import LazyMedia from "@/components/LazyMedia";
import { useToast } from "@/context/ToastContext";
import GalleryBackToTop from "@/components/GalleryBackToTop";
import VideoRemixOnboardingModal from "@/components/VideoRemixOnboardingModal";

export type FeedItem = {
    id: string; // generation id
    imageUrl: string;
    videoUrl?: string | null; // For video generations
    mediaType: "image" | "video"; // Type of media
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
    promptId?: string | null;
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
    const [timeFilter, setTimeFilter] = useState<"today" | "week" | "all">("all");
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true); // Assume more unless initial fetch was empty? 
    // Actually if initialItems < 8, we know there's no more.

    // We need to track if we've done the client-side mount fetch or if we rely on initial.
    // Ideally: Page 0 is provided. We only fetch if Page > 0 OR Sort changes.
    const mountedRef = useRef(false);

    const { showToast } = useToast();
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);

    // Video Remix State
    const [videoRemixOpen, setVideoRemixOpen] = useState(false);
    const [selectedVideoRemix, setSelectedVideoRemix] = useState<FeedItem | null>(null);


    // V1 Video Onboarding State
    const [showVideoOnboarding, setShowVideoOnboarding] = useState(false);
    const [pendingVideoRemix, setPendingVideoRemix] = useState<FeedItem | null>(null);
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

            let qImages;

            if (sort === "trending") {
                // Use trending views based on time filter
                let viewName = "trending_generations";
                if (timeFilter === "today") viewName = "trending_today";
                else if (timeFilter === "week") viewName = "trending_week";

                qImages = supabase
                    .from(viewName)
                    .select(`
                        id, image_url, created_at, upvotes_count, user_id, prompt_id
                    `)
                    .range(page * 12, (page + 1) * 12 - 1)
                    .order("trending_score", { ascending: false });
            } else {
                qImages = supabase
                    .from("prompt_generations")
                    .select(`
                        id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text, is_public,
                        user_id, prompt_id
                    `)
                    .eq("is_public", true)
                    .range(page * 12, (page + 1) * 12 - 1)
                    .order("created_at", { ascending: false });
            }

            let qVideos = supabase
                .from("video_generations")
                .select(`id, video_url, created_at, upvotes_count, prompt, dialogue, is_public, user_id, source_image_id, thumbnail_url, prompt_generations!source_image_id(image_url)`)
                .eq("is_public", true)
                .eq("status", "completed")
                .range(page * 12, (page + 1) * 12 - 1);

            if (sort === "newest") {
                qVideos = qVideos.order("created_at", { ascending: false });
            } else {
                qVideos = qVideos.order("upvotes_count", { ascending: false }).order("created_at", { ascending: false });
            }

            const [resImages, resVideos] = await Promise.all([qImages, qVideos]);

            if (resImages.error) console.error("Images Error:", resImages.error);
            if (resVideos.error) console.error("Videos Error:", resVideos.error);

            if (resImages.error || resVideos.error) {
                // setLoading(false);
                // return;
            }

            // Merge Data
            const images = resImages.data || [];
            const videos = resVideos.data || [];

            // If we run out of both, stop
            if (images.length === 0 && videos.length === 0) {
                setHasMore(false);
                setLoading(false);
                return;
            }

            // Combine and Sort
            let combinedData = [];

            // Map Images
            const mappedImages = images.map((d: any) => ({
                ...d,
                mediaType: "image",
                timestamp: new Date(d.created_at).getTime()
            }));

            // Map Videos
            const mappedVideos = videos.map((d: any) => {
                let img = d.thumbnail_url;
                if (!img && d.prompt_generations) {
                    if (Array.isArray(d.prompt_generations)) {
                        img = d.prompt_generations[0]?.image_url;
                    } else {
                        img = d.prompt_generations.image_url;
                    }
                }
                if (!img) img = "/orb-neon.gif"; // Fallback

                return {
                    ...d,
                    mediaType: "video",
                    timestamp: new Date(d.created_at).getTime(),
                    image_url: img,
                    settings: { headline: d.prompt?.slice(0, 50) || "Video" },
                    original_prompt_text: d.prompt,
                    remix_prompt_text: "",
                    combined_prompt_text: d.prompt
                };
            });

            combinedData = [...mappedImages, ...mappedVideos].sort((a, b) => {
                if (sort === "newest") {
                    return b.timestamp - a.timestamp;
                }
                return (b.upvotes_count || 0) - (a.upvotes_count || 0);
            });

            // Since we fetched 12 of each, we might have too many. 
            // In a simple naive pagination without cursor, we just append them all.
            // It's not perfect but works for now.

            const data = combinedData;

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
                    const { data: myVideoUpvotes } = await supabase.from("video_upvotes").select("video_id").eq("user_id", user.id).in("video_id", genIds);

                    myUpvotedSet = new Set([
                        ...(myUpvotes?.map((u: any) => u.generation_id) || []),
                        ...(myVideoUpvotes?.map((u: any) => u.video_id) || [])
                    ]);

                    const { data: mySaved } = await supabase.from("prompt_favorites").select("generation_id").eq("user_id", user.id).in("generation_id", genIds);
                    const { data: myVideoSaved } = await supabase.from("video_favorites").select("video_id").eq("user_id", user.id).in("video_id", genIds);

                    mySavedSet = new Set([
                        ...(mySaved?.map((u: any) => u.generation_id) || []),
                        ...(myVideoSaved?.map((u: any) => u.video_id) || [])
                    ]);
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
                    videoUrl: d.video_url,
                    mediaType: d.mediaType,
                    createdAt: d.created_at,
                    upvotesCount: d.upvotes_count || 0,
                    isLiked: myUpvotedSet.has(d.id),
                    isSaved: mySavedSet.has(d.id),
                    userId: d.user_id,
                    username: profile.full_name || "Anonymous Creator",
                    userAvatar: profile.profile_image || null,
                    promptTitle: settings.headline || "Untitled",
                    originalPromptText: original,
                    remixPromptText: remix,
                    combinedPromptText: combined,
                    fullQualityUrl: settings.full_quality_url || null,
                    promptId: d.prompt_id || null,
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, sort, timeFilter]);

    // Handle Sort Click
    const handleSort = (s: "newest" | "trending") => {
        if (s === sort) return;
        setSort(s);
        setPage(0);
        setHasMore(true);
        setItems([]);
    };

    // Handle Time Filter Click
    const handleTimeFilter = (t: "today" | "week" | "all") => {
        if (t === timeFilter) return;
        setTimeFilter(t);
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
            if (item.mediaType === "video") {
                await supabase.from("video_upvotes").delete().match({ user_id: user.id, video_id: item.id });
            } else {
                await supabase.from("remix_upvotes").delete().match({ user_id: user.id, generation_id: item.id });
            }
        } else {
            // Use maybeSingle or ignore error if it already exists (race condition with optimistic UI)
            if (item.mediaType === "video") {
                await supabase.from("video_upvotes").upsert({ user_id: user.id, video_id: item.id }, { onConflict: "user_id, video_id", ignoreDuplicates: true });
            } else {
                await supabase.from("remix_upvotes").upsert({ user_id: user.id, generation_id: item.id }, { onConflict: "user_id, generation_id", ignoreDuplicates: true });
            }
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
            if (item.mediaType === "video") {
                const { error: err } = await supabase.from("video_favorites").delete().match({ user_id: user.id, video_id: item.id });
                error = err;
            } else {
                const { error: err } = await supabase.from("prompt_favorites").delete().match({ user_id: user.id, generation_id: item.id });
                error = err;
            }
        } else {
            if (item.mediaType === "video") {
                // Use upsert to ignore duplicates
                const { error: err } = await supabase.from("video_favorites").upsert({ user_id: user.id, video_id: item.id }, { onConflict: "user_id, video_id", ignoreDuplicates: true });
                error = err;
            } else {
                const { error: err } = await supabase.from("prompt_favorites").upsert({ user_id: user.id, generation_id: item.id }, { onConflict: "user_id, generation_id", ignoreDuplicates: true });
                error = err;
            }
        }

        if (error) {
            showToast("Failed to save: " + error.message, "error");
            setItems(prev => prev.map(i => i.id === item.id ? { ...i, isSaved: wasSaved } : i));
        }
    };

    const openLightbox = (item: FeedItem) => {
        // Navigate to detail page for both images and videos
        router.push(`/remix/${item.id}`);
    };

    const handleRemix = (payload: any) => {
        // Check for Video Type directly from payload (if extended) or we need to pass the whole item?
        // Since we are calling this from the button where we have 'item', let's update the call site.
        // OR we can try to detect from the payload if we pass mediaType.

        let href = `/studio?img=${encodeURIComponent(payload.imgUrl)}` +
            `&remix=${encodeURIComponent(payload.remixPromptText || "")}`;

        if (payload.promptId) {
            href += `&promptId=${encodeURIComponent(payload.promptId)}`;
        }
        if (payload.intent) {
            href += `&intent=${encodeURIComponent(payload.intent)}`;
        }

        router.push(href);
    };

    const handleRemixClick = (item: FeedItem) => {
        if (item.mediaType === "video") {
            // Intercept for Onboarding Modal
            setPendingVideoRemix(item);
            setShowVideoOnboarding(true);
            return;
        }
        // V1 Video Remix Flow:
        // Everything goes to Studio (Image Lab).
        // For video, we pass the video thumbnail (or imageURL) as the source image.

        handleRemix({
            imgUrl: item.imageUrl, // For video items, this is already mapped to thumbnail/frame
            remixPromptText: item.remixPromptText,
            originalPromptText: item.originalPromptText,
            combinedPromptText: item.combinedPromptText,
            promptId: item.promptId
        });
    };

    const handleVideoRemixStart = () => {
        if (!pendingVideoRemix) return;

        setShowVideoOnboarding(false);
        handleRemix({
            imgUrl: pendingVideoRemix.imageUrl,
            remixPromptText: pendingVideoRemix.remixPromptText,
            originalPromptText: pendingVideoRemix.originalPromptText,
            combinedPromptText: pendingVideoRemix.combinedPromptText,
            promptId: pendingVideoRemix.promptId,
            intent: "video"
        });
        setPendingVideoRemix(null);
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
                <div className="flex flex-col gap-2">
                    {/* Main Sort Tabs */}
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

                    {/* Time Filter Tabs - Only show when Trending is active */}
                    {sort === "trending" && (
                        <div className="flex bg-zinc-900 p-1 rounded-lg self-start">
                            <button
                                onClick={() => handleTimeFilter("today")}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${timeFilter === "today" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`}
                            >
                                Today
                            </button>
                            <button
                                onClick={() => handleTimeFilter("week")}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${timeFilter === "week" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`}
                            >
                                This Week
                            </button>
                            <button
                                onClick={() => handleTimeFilter("all")}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${timeFilter === "all" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`}
                            >
                                All Time
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="mx-auto max-w-6xl grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6">
                {items.map((item, index) => (
                    <article ref={index === items.length - 1 ? lastElementRef : null} key={`${item.id}-${index}`} className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden">
                        <div className="relative aspect-[9/16] w-full bg-black cursor-pointer group" onClick={() => openLightbox(item)}>
                            {/* Render Video or Image */}
                            <LazyMedia
                                type={item.mediaType}
                                src={item.mediaType === "video" ? (item.videoUrl || "") : item.imageUrl}
                                poster={item.imageUrl}
                                alt={item.promptTitle}
                                className="absolute inset-0 w-full h-full"
                                unoptimized
                            />

                            {/* Video Badge */}
                            {item.mediaType === "video" && (
                                <div className="absolute top-3 right-3 z-10 bg-black/70 text-lime-400 text-[10px] font-bold uppercase px-2 py-1 rounded-full flex items-center gap-1">
                                    <span className="w-2 h-2 bg-lime-400 rounded-full animate-pulse" />
                                    Video
                                </div>
                            )}

                            {/* Overlay Gradient */}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                            {/* Top Left: User Info Overlay */}
                            <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                                <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/20 bg-zinc-800">
                                    {item.userAvatar ? (
                                        <Image src={item.userAvatar} fill className="object-cover" alt={item.username} />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-white/50">
                                            <User size={14} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white shadow-black drop-shadow-md leading-tight">
                                        {item.username}
                                    </span>
                                    <span className="text-[10px] text-white/80 shadow-black drop-shadow-md leading-tight">
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>

                        <div className="p-3 flex items-center justify-between bg-zinc-900 border-t border-white/5">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => handleUpvote(item)}
                                    className={`flex items-center gap-1.5 text-xs font-bold transition group ${item.isLiked ? "text-[#B7FF00]" : "text-white/60 hover:text-white"}`}
                                >
                                    <ArrowBigUp size={20} fill={item.isLiked ? "currentColor" : "none"} className={`transition-transform group-active:scale-125 ${item.isLiked ? "scale-110" : ""}`} />
                                    <span>{item.upvotesCount}</span>
                                </button>

                                <button
                                    onClick={() => handleSave(item)}
                                    className={`flex items-center gap-1.5 text-xs font-bold transition group ${item.isSaved ? "text-pink-500" : "text-white/60 hover:text-white"}`}
                                >
                                    <Heart size={18} fill={item.isSaved ? "currentColor" : "none"} className="transition-transform group-active:scale-90" />
                                </button>
                            </div>

                            <button
                                onClick={() => handleRemixClick(item)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#B7FF00] text-black hover:bg-[#a3e600] transition active:scale-95"
                                title="Remix this"
                            >
                                <RefreshCw size={18} />
                            </button>
                        </div>
                    </article>
                ))}

                {loading && (
                    <div className="col-span-2 md:col-span-3 py-20 flex flex-col items-center justify-center w-full min-h-[50vh]">
                        <Loading />
                    </div>
                )}

                {!loading && items.length === 0 && (
                    <div className="text-center py-20 text-white/40">
                        No public remixes yet. Be the first to share one!
                    </div>
                )}
            </div>

            {/* Sticky Back To Top */}
            <div className="sticky bottom-8 flex justify-center pointer-events-none z-50 mt-8">
                <GalleryBackToTop />
            </div>

            {selectedItem && (
                <GenerationLightbox
                    open={lightboxOpen}
                    url={selectedItem.imageUrl}
                    videoUrl={selectedItem.videoUrl}
                    mediaType={selectedItem.mediaType}
                    onClose={() => setLightboxOpen(false)}
                    originalPromptText={selectedItem.originalPromptText}
                    remixPromptText={selectedItem.remixPromptText}
                    combinedPromptText={selectedItem.combinedPromptText}
                    onShare={() => { }}
                    onRemix={selectedItem.mediaType === "image" ? handleRemix : undefined}
                    title={selectedItem.promptTitle}
                    fullQualityUrl={selectedItem.fullQualityUrl}
                />
            )}

            <VideoGeneratorModal
                isOpen={videoRemixOpen}
                onClose={() => setVideoRemixOpen(false)}
                sourceImage={selectedVideoRemix?.imageUrl || ""}
                sourceImageId={selectedVideoRemix?.id}
                userId={selectedVideoRemix?.userId || undefined}

            />

            <VideoRemixOnboardingModal
                isOpen={showVideoOnboarding}
                onClose={() => setShowVideoOnboarding(false)}
                onStart={handleVideoRemixStart}
            />
        </main>
    );
}
