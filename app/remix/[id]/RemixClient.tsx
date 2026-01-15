"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Copy, Download, Share2, Sparkles, ArrowLeft, Heart, ChevronDown } from "lucide-react";

export type RemixDetail = {
    id: string;
    image_url: string;
    created_at: string;
    prompt_slug: string | null;
    combined_prompt_text?: string | null;
    user_id: string;
    settings?: any;
    profiles?: {
        full_name: string | null;
        avatar_url: string | null;
        created_at: string;
    };
};

type Props = {
    initialRemix?: RemixDetail | null;
};

export default function RemixClient({ initialRemix }: Props) {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [remix, setRemix] = useState<RemixDetail | null>(initialRemix || null);
    const [userRemixes, setUserRemixes] = useState<RemixDetail[]>([]);
    const [communityRemixes, setCommunityRemixes] = useState<RemixDetail[]>([]);
    const [loading, setLoading] = useState(!initialRemix);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isFavorited, setIsFavorited] = useState(false);
    const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

    // Pagination state
    const [visibleCount, setVisibleCount] = useState(8);

    useEffect(() => {
        if (!id) return;

        async function load() {
            const supabase = createSupabaseBrowserClient();

            let currentRemix = remix;

            // 1. Fetch Main Remix if not provided by server
            if (!initialRemix) {
                const { data: remixData, error: remixError } = await supabase
                    .from("prompt_generations")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle();

                if (remixError) {
                    setError(remixError.message);
                    setLoading(false);
                    return;
                } else if (!remixData) {
                    setError("Remix not found");
                    setLoading(false);
                    return;
                }

                // Fetch Profile Separately
                const { data: profileData } = await supabase
                    .from("profiles")
                    .select("full_name, profile_image")
                    .eq("user_id", remixData.user_id)
                    .maybeSingle();

                const fullRemixData: RemixDetail = {
                    ...remixData,
                    profiles: profileData ? {
                        full_name: profileData.full_name,
                        avatar_url: profileData.profile_image,
                        created_at: ""
                    } : {
                        full_name: "Anonymous Creator",
                        avatar_url: null,
                        created_at: ""
                    }
                };

                setRemix(fullRemixData);
                currentRemix = fullRemixData;
            }

            // If we still don't have a remix (impossible if initialRemix worked or fetch worked), exit
            if (!currentRemix) return;

            // 2. Load Recommendations & Favorites (Always fetch these on client to keep page cacheable/light or just standard flow)

            // Check favorite status
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: fav } = await supabase
                    .from("favorites")
                    .select("id")
                    .eq("user_id", user.id)
                    .eq("record_id", id)
                    .eq("type", "generation")
                    .maybeSingle();
                setIsFavorited(!!fav);
            }

            // Load other remixes by this user
            const { data: otherRemixes } = await supabase
                .from("prompt_generations")
                .select("id, image_url, created_at, user_id")
                .eq("user_id", currentRemix.user_id)
                .neq("id", id)
                .eq("is_public", true)
                .order("created_at", { ascending: false })
                .limit(32);

            if (otherRemixes) {
                setUserRemixes(otherRemixes as any);
            }

            // Load Random Community Remixes
            const { data: randomData } = await supabase
                .from("prompt_generations")
                .select("id, image_url, created_at")
                .eq("is_public", true)
                .neq("user_id", currentRemix.user_id)
                .order("created_at", { ascending: false })
                .limit(50);

            if (randomData) {
                const shuffled = randomData.sort(() => 0.5 - Math.random());
                setCommunityRemixes(shuffled.slice(0, 8) as any);
            }

            setLoading(false);
        }

        load();
    }, [id]); // Only re-run if ID changes. 'remix' state change should not trigger re-fetch. 
    // Handled by defining 'currentRemix' var. 
    // Better: Only trigger if ID changes or on mount.
    // Actually, if we have initialRemix, we skip step 1.

    const handleToggleFavorite = async () => {
        if (!remix || isTogglingFavorite) return;

        setIsTogglingFavorite(true);
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push("/login"); // Or open login modal
            return;
        }

        try {
            if (isFavorited) {
                await supabase
                    .from("favorites")
                    .delete()
                    .eq("user_id", user.id)
                    .eq("record_id", remix.id)
                    .eq("type", "generation");
                setIsFavorited(false);
            } else {
                await supabase
                    .from("favorites")
                    .insert({
                        user_id: user.id,
                        record_id: remix.id,
                        type: "generation"
                    });
                setIsFavorited(true);
            }
        } catch (e) {
            console.error("Failed to toggle favorite:", e);
        } finally {
            setIsTogglingFavorite(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-white">
                <span className="animate-pulse">Loading remix...</span>
            </div>
        );
    }

    if (error || !remix) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-20 text-center text-white">
                <h1 className="text-2xl font-bold text-red-400">Error</h1>
                <p className="mt-2 text-white/60">{error}</p>
                <button
                    onClick={() => router.back()}
                    className="mt-6 rounded-xl border border-white/10 bg-white/5 px-6 py-2 hover:bg-white/10"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // ignore
        }
    };

    const handleDownload = async () => {
        try {
            const res = await fetch(remix.image_url, { mode: "cors" });
            const blob = await res.blob();
            const obj = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = obj;
            a.download = `remix-${remix.id}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(obj);
        } catch {
            window.open(remix.image_url, "_blank", "noopener,noreferrer");
        }
    };

    const handleRemixThis = () => {
        if (remix.prompt_slug) {
            router.push(`/prompts/${remix.prompt_slug}?remix=${encodeURIComponent(remix.combined_prompt_text || "")}&img=${encodeURIComponent(remix.image_url)}`);
        } else {
            router.push(`/studio?remix=${encodeURIComponent(remix.combined_prompt_text || "")}`);
        }
    };

    return (
        <main className="min-h-screen pb-20 pt-10 px-4 md:pt-16">
            <div className="mx-auto max-w-5xl">
                {/* Nav */}
                <div className="mb-6 flex items-center justify-between gap-4">
                    <button
                        onClick={() => remix.prompt_slug ? router.push(`/prompts/${remix.prompt_slug}`) : router.back()}
                        className="flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={16} />
                        Back to {remix.prompt_slug ? "Prompt" : "Gallery"}
                    </button>

                    <button
                        onClick={() => router.push("/feed")}
                        className="flex items-center gap-2 text-sm font-bold text-[#B7FF00] hover:text-white transition-colors"
                    >
                        Go to Community
                        <ArrowLeft size={16} className="rotate-180" />
                    </button>
                </div>

                <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
                    {/* Image Column */}
                    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl md:aspect-[3/4] lg:aspect-square">
                        <Image
                            src={remix.image_url}
                            alt="User Remix"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>

                    {/* Info Column */}
                    <div className="flex flex-col justify-center space-y-8">
                        <div>
                            {/* Creator Profile */}
                            <div className="flex items-center gap-3 mb-6">
                                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-zinc-800 shrink-0">
                                    {remix.profiles?.avatar_url ? (
                                        <Image
                                            src={remix.profiles.avatar_url}
                                            alt={remix.profiles.full_name || "Creator"}
                                            fill
                                            className="object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-white/40">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="20"
                                                height="20"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-white leading-none">
                                        {remix.profiles?.full_name || "Anonymous Creator"}
                                    </div>
                                    <div className="text-xs text-white/40 mt-1">
                                        Community Member
                                    </div>
                                </div>
                            </div>

                            <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                                Community Remix
                            </h1>
                            <p className="mt-2 text-white/60">
                                Generated by a community member using the AI Skills Studio platform.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={handleRemixThis}
                                className="flex items-center justify-center gap-2 rounded-xl bg-[#B7FF00] px-6 py-4 text-sm font-bold text-black transition-transform hover:scale-[1.02] hover:bg-[#a3e600] shadow-[0_0_20px_-5px_#B7FF00] sm:col-span-2"
                            >
                                <Sparkles size={18} />
                                Remix This
                            </button>

                            <button
                                onClick={handleToggleFavorite}
                                disabled={isTogglingFavorite}
                                className={`flex items-center justify-center gap-2 rounded-xl border px-6 py-4 text-sm font-bold transition-colors whitespace-nowrap ${isFavorited
                                    ? "border-red-400/50 bg-red-400/10 text-red-400 hover:bg-red-400/20"
                                    : "border-white/15 bg-white/5 text-white hover:bg-white/10"
                                    }`}
                            >
                                <Heart size={18} className={isFavorited ? "fill-current" : ""} />
                                {isFavorited ? "Favorited" : "Favorite"}
                            </button>

                            <button
                                onClick={handleDownload}
                                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-white/10 whitespace-nowrap"
                            >
                                <Download size={18} />
                                Download
                            </button>

                            <button
                                onClick={handleCopyLink}
                                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-white/10 whitespace-nowrap sm:col-span-2"
                            >
                                {copied ? <span className="text-lime-400">Copied!</span> : <><Share2 size={18} /> Share</>}
                            </button>
                        </div>

                        {/* Prompt Data (Optional) */}
                        {remix.combined_prompt_text && (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-white/40">Prompt Used</div>
                                <p className="font-mono text-sm leading-relaxed text-white/80 line-clamp-6">
                                    {remix.combined_prompt_text}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* More from this Creator */}
                {userRemixes.length > 0 && (
                    <div className="mt-16">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">More from this Creator</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {userRemixes.slice(0, visibleCount).map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => router.push(`/remix/${r.id}`)}
                                    className="group relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 hover:border-[#B7FF00]/50 transition-all hover:scale-[1.02]"
                                >
                                    <Image
                                        src={r.image_url}
                                        alt="Creator Remix"
                                        fill
                                        className="object-cover group-hover:opacity-90 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>

                        {/* Show More Button */}
                        {visibleCount < userRemixes.length && (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={() => setVisibleCount(prev => prev + 12)}
                                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-8 py-3 text-sm font-bold text-white transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
                                >
                                    Show More
                                    <ChevronDown size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Divider */}
                <div className="my-16 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                {/* Community Remixes */}
                {communityRemixes.length > 0 && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">More Community Remixes</h2>
                            <button
                                onClick={() => router.push("/feed")}
                                className="text-sm font-bold text-[#B7FF00] hover:text-white transition-colors"
                            >
                                View All
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {communityRemixes.map((r) => (
                                <button
                                    key={r.id}
                                    onClick={() => router.push(`/remix/${r.id}`)}
                                    className="group relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/40 hover:border-[#B7FF00]/50 transition-all hover:scale-[1.02]"
                                >
                                    <Image
                                        src={r.image_url}
                                        alt="Community Remix"
                                        fill
                                        className="object-cover group-hover:opacity-90 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
