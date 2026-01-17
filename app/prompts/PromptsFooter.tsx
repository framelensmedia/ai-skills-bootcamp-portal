"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import PromptCard from "@/components/PromptCard";
import RemixCard from "@/components/RemixCard";
import GalleryBackToTop from "@/components/GalleryBackToTop";
import LoadingOrb from "@/components/LoadingOrb";
import { RefreshCw, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function PromptsFooter() {
    const supabase = createSupabaseBrowserClient();

    // Data State
    const [trendingPrompts, setTrendingPrompts] = useState<any[]>([]);
    const [communityRemixes, setCommunityRemixes] = useState<any[]>([]);

    // Carousel State
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    // Pagination State
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingRemixes, setLoadingRemixes] = useState(false);

    // Observer
    const observer = useRef<IntersectionObserver | null>(null);
    const lastRemixRef = useCallback((node: HTMLDivElement | null) => {
        if (loadingRemixes) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore) {
                setPage((prev) => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loadingRemixes, hasMore]);

    // Fetch Trending Prompts (Limit 10 for slider)
    useEffect(() => {
        const fetchTrending = async () => {
            const { data: promptsData } = await supabase
                .from("prompts_public")
                .select("id, title, slug, summary, category, access_level, image_url, featured_image_url, media_url")
                .order("created_at", { ascending: false })
                .limit(10);

            if (promptsData) setTrendingPrompts(promptsData);
        };
        fetchTrending();
    }, [supabase]);

    // Carousel Logic
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleScroll = () => {
            const { scrollLeft, scrollWidth, clientWidth } = el;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        };

        el.addEventListener("scroll", handleScroll, { passive: true });
        // Initial check needs a small delay to allow render
        setTimeout(handleScroll, 200);
        return () => el.removeEventListener("scroll", handleScroll);
    }, [trendingPrompts]);

    const scroll = (direction: "left" | "right") => {
        if (!scrollRef.current) return;
        const scrollAmount = scrollRef.current.clientWidth * 0.6;
        scrollRef.current.scrollBy({
            left: direction === "left" ? -scrollAmount : scrollAmount,
            behavior: "smooth",
        });
    };

    // Fetch Infinite Remixes
    useEffect(() => {
        const fetchRemixes = async () => {
            if (!hasMore) return;
            setLoadingRemixes(true);

            const LIMIT = 8;
            const from = page * LIMIT;
            const to = from + LIMIT - 1;

            const { data: remixesData } = await supabase
                .from("prompt_generations")
                .select(`
                     id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text,
                     user_id, prompt_id
                  `)
                .eq("is_public", true)
                .order("created_at", { ascending: false })
                .range(from, to);

            if (remixesData) {
                if (remixesData.length < LIMIT) {
                    setHasMore(false);
                }

                // Fetch profiles for remixes
                const userIds = Array.from(new Set(remixesData.map((r: any) => r.user_id)));
                let profileMap = new Map();
                if (userIds.length > 0) {
                    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, profile_image").in("user_id", userIds);
                    profiles?.forEach((p: any) => profileMap.set(p.user_id, p));
                }

                const processedRemixes = remixesData.map((r: any) => {
                    const profile = profileMap.get(r.user_id) || {};
                    const settings = r.settings || {};
                    return {
                        id: r.id,
                        imageUrl: r.image_url,
                        title: settings.headline || "Untitled Remix",
                        username: profile.full_name || "Anonymous Creator",
                        userAvatar: profile.profile_image || null,
                        upvotesCount: r.upvotes_count || 0,
                        originalPromptText: r.original_prompt_text,
                        remixPromptText: r.remix_prompt_text,
                        combinedPromptText: r.combined_prompt_text,
                        createdAt: r.created_at,
                        promptId: r.prompt_id || null
                    };
                });

                setCommunityRemixes((prev) => {
                    // Unique check
                    const newIds = new Set(processedRemixes.map((r: any) => r.id));
                    const filteredPrev = prev.filter(p => !newIds.has(p.id));
                    return [...filteredPrev, ...processedRemixes];
                });
            } else {
                setHasMore(false);
            }
            setLoadingRemixes(false);
        };
        fetchRemixes();
    }, [page, supabase]);

    return (
        <div className="flex flex-col gap-12">
            {/* Trending Prompts */}
            {/* Trending Prompts Carousel */}
            {trendingPrompts.length > 0 && (
                <div className="pt-12 border-t border-white/10 group/slider">
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                                <TrendingUp size={24} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-2xl font-bold text-white mb-1 truncate">Trending Prompts</h2>
                                <div className="inline-flex items-center gap-2 rounded-2xl rounded-br-none border border-white/10 bg-[#1A1A1A] px-3 py-1.5 shadow-sm transition hover:bg-white/5 cursor-default max-w-full">
                                    <span className="text-purple-400 flex-shrink-0">●</span>
                                    <span className="text-xs font-medium text-white truncate">Most popular templates right now</span>
                                </div>
                            </div>
                        </div>

                        {/* Controls - Hidden on mobile, visible on tablet+ */}
                        <div className="hidden sm:flex gap-2 opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300">
                            <button
                                onClick={() => scroll("left")}
                                disabled={!canScrollLeft}
                                className="rounded-full bg-white/5 p-3 text-white/60 backdrop-blur-md transition hover:bg-white/10 hover:text-[#B7FF00] disabled:opacity-30 border border-white/5"
                                aria-label="Scroll left"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => scroll("right")}
                                disabled={!canScrollRight}
                                className="rounded-full bg-white/5 p-3 text-white/60 backdrop-blur-md transition hover:bg-white/10 hover:text-[#B7FF00] disabled:opacity-30 border border-white/5"
                                aria-label="Scroll right"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>

                    <div
                        ref={scrollRef}
                        className="flex gap-6 overflow-x-auto pb-8 pt-2 scrollbar-hide snap-x snap-mandatory"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                        {trendingPrompts.map((p) => (
                            <div key={p.id} className="min-w-[300px] w-[300px] snap-center">
                                <PromptCard
                                    id={p.id}
                                    title={p.title}
                                    summary={p.summary || ""}
                                    slug={p.slug}
                                    featuredImageUrl={p.featured_image_url || p.image_url || p.media_url}
                                    category={p.category}
                                    accessLevel={p.access_level}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Infinite Community Remixes */}
            {communityRemixes.length > 0 && (
                <div className="pt-12 border-t border-white/10 relative">
                    <div className="mb-8 flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
                            <RefreshCw size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">Community Remixes</h2>
                            <div className="inline-flex items-center gap-2 rounded-2xl rounded-br-none border border-white/10 bg-[#1A1A1A] px-3 py-1.5 shadow-sm transition hover:bg-white/5 cursor-default">
                                <span className="text-blue-400">●</span>
                                <span className="text-xs font-medium text-white">Fresh inspiration made by creators like you</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {communityRemixes.map((r, index) => (
                            <div key={r.id} ref={index === communityRemixes.length - 1 ? lastRemixRef : null}>
                                <RemixCard item={r} />
                            </div>
                        ))}
                    </div>

                    {loadingRemixes && (
                        <div className="py-8 flex justify-center w-full">
                            <LoadingOrb />
                        </div>
                    )}

                    {/* Gallery Back To Top Button - Sticky to this container */}
                    <div className="sticky bottom-8 flex justify-center pointer-events-none z-50 mt-8">
                        <GalleryBackToTop />
                    </div>
                </div>
            )}
        </div>
    );
}
