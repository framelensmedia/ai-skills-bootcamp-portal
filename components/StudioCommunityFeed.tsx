"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import PromptCard from "@/components/PromptCard";
import RemixCard from "@/components/RemixCard";
import LoadingOrb from "@/components/LoadingOrb";
import GalleryBackToTop from "@/components/GalleryBackToTop";

export default function StudioCommunityFeed() {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [communityPrompts, setCommunityPrompts] = useState<any[]>([]);
    const [communityRemixes, setCommunityRemixes] = useState<any[]>([]);
    const [feedTab, setFeedTab] = useState<"latest" | "trending">("latest");
    // We reset page/data when tab changes, so keep track of current tab for fetch consistency
    const [fetchingTab, setFetchingTab] = useState<"latest" | "trending">("latest");

    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingRemixes, setLoadingRemixes] = useState(false);
    const observer = useRef<IntersectionObserver | null>(null);

    // Reset feed when tab switches
    useEffect(() => {
        setCommunityRemixes([]);
        setPage(0);
        setHasMore(true);
        setFetchingTab(feedTab);
    }, [feedTab]);

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

    // Fetch Prompts (Once)
    useEffect(() => {
        const fetchPrompts = async () => {
            const { data: promptsData } = await supabase
                .from("prompts_public")
                .select("id, title, slug, summary, category, access_level, image_url, featured_image_url, media_url")
                .order("created_at", { ascending: false })
                .limit(4);

            if (promptsData) setCommunityPrompts(promptsData);
        };
        fetchPrompts();
    }, [supabase]);

    // Fetch Remixes (Paginated)
    useEffect(() => {
        const fetchRemixes = async () => {
            if (!hasMore && page > 0) return;
            setLoadingRemixes(true);

            const LIMIT = 12; // Increased for better UX
            const from = page * LIMIT;
            const to = from + LIMIT - 1;

            try {
                // Build query based on tab
                let query = supabase
                    .from("prompt_generations")
                    .select(`
                         id, image_url, video_url, media_type, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text,
                         user_id, prompt_id
                      `)
                    .eq("is_public", true)
                    .not("image_url", "is", null); // Only show items with images

                // Apply ordering BEFORE range for consistent results
                if (fetchingTab === "trending") {
                    query = query
                        .order("upvotes_count", { ascending: false })
                        .order("created_at", { ascending: false });
                } else {
                    // Latest: newest first
                    query = query.order("created_at", { ascending: false });
                }

                // Apply range after ordering
                query = query.range(from, to);

                const { data: remixesData, error } = await query;

                if (error) {
                    console.error("Fetch error:", error);
                    setLoadingRemixes(false);
                    return;
                }

                if (remixesData) {
                    if (remixesData.length < LIMIT) {
                        setHasMore(false);
                    }

                    if (remixesData.length === 0) {
                        setLoadingRemixes(false);
                        return;
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
                            videoUrl: r.video_url || null,
                            mediaType: r.media_type || (r.video_url ? "video" : "image"),
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
                        // If page 0, replace entirely
                        if (page === 0) return processedRemixes;

                        // Append new items, avoiding duplicates by ID
                        const existingIds = new Set(prev.map((r: any) => r.id));
                        const newItems = processedRemixes.filter((r: any) => !existingIds.has(r.id));
                        return [...prev, ...newItems];
                    });
                }
            } catch (e) {
                console.error("Feed Error", e);
            } finally {
                setLoadingRemixes(false);
            }
        };

        fetchRemixes();
    }, [page, fetchingTab, supabase, hasMore]);

    return (
        <div className="space-y-8">
            {/* Trending Prompts */}
            {communityPrompts.length > 0 && (
                <div className="pt-6 border-t border-white/10">
                    <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider opacity-60">Trending Prompts</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {communityPrompts.map((p) => (
                            <div key={p.id} className="scale-[0.85] origin-top-left -mr-[15%] -mb-[15%]">
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
                    <div className="mt-8 flex justify-center">
                        <Link
                            href="/prompts"
                            className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 hover:scale-105 hover:border-lime-400/50"
                        >
                            <span>View More Templates</span>
                            <ArrowRight size={16} className="text-lime-400 transition-transform group-hover:translate-x-1" />
                        </Link>
                    </div>
                </div>
            )}

            {/* Community Remixes */}
            {communityRemixes.length > 0 && (
                <div className="pt-6 border-t border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider opacity-60">Community Remixes</h3>
                        <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                            <button
                                onClick={() => setFeedTab("latest")}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${feedTab === "latest" ? "bg-lime-400 text-black shadow-sm" : "text-white/40 hover:text-white"
                                    }`}
                            >
                                Latest
                            </button>
                            <button
                                onClick={() => setFeedTab("trending")}
                                className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${feedTab === "trending" ? "bg-lime-400 text-black shadow-sm" : "text-white/40 hover:text-white"
                                    }`}
                            >
                                Trending
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {communityRemixes.map((r, index) => (
                            <div key={r.id} ref={index === communityRemixes.length - 1 ? lastRemixRef : null}>
                                <RemixCard item={r} />
                            </div>
                        ))}
                    </div>
                    {loadingRemixes && (
                        <div className="py-4 flex justify-center w-full">
                            <LoadingOrb />
                        </div>
                    )}

                    {/* Sticky Back To Top for Feed */}
                    <div className="sticky bottom-8 flex justify-center pointer-events-none z-50 mt-8">
                        <GalleryBackToTop />
                    </div>
                </div>
            )}
        </div>
    );
}
