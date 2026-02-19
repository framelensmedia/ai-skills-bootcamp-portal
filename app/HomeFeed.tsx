"use client";

// ... existing imports ...
import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import PromptCard from "@/components/PromptCard";
import RemixCard, { RemixItem } from "@/components/RemixCard";
import { Wand2, ArrowRight, Flame, RefreshCw, Search, Star } from "lucide-react";
import Image from "next/image";
import SuccessStories from "@/components/home/SuccessStories";
import BasicTrainingSection from "@/components/home/BasicTrainingSection";
import WhatYouWillLearnSection from "@/components/home/WhatYouWillLearnSection";

// --- Subcomponents ---

function Tag({ text }: { text: string }) {
    return (
        <span className="inline-flex items-center rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#B7FF00]">
            {text}
        </span>
    );
}

function MiniCard({
    tag,
    title,
    desc,
    comingSoon,
}: {
    tag: string;
    title: string;
    desc: string;
    comingSoon?: boolean;
}) {
    return (
        <div className="rounded-2xl border border-border bg-card p-4 hover:border-border/80">
            <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-muted to-background/40" />
            <p className="mt-4 text-xs font-semibold text-[#B7FF00]">
                {tag}{" "}
                {comingSoon ? (
                    <span className="ml-2 rounded-full border border-border bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/60">
                        COMING SOON
                    </span>
                ) : null}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
            <div className="mt-4">
                <span className="text-xs text-muted-foreground hover:text-foreground">
                    {comingSoon ? "Preview →" : "Read now →"}
                </span>
            </div>
        </div>
    );
}

export type PublicPrompt = {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    category: string | null;
    access_level: string;
    created_at: string | null;

    featured_image_url: string | null;
    image_url: string | null;
    media_url: string | null;
};

export type InstructorBootcamp = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    featured_image_url: string | null;
    status: string;
    notify_enabled: boolean;
    // Discriminator to help runtime checks if needed, but we can check properties
    type?: "instructor_bootcamp";
};

type SliderItem = PublicPrompt | InstructorBootcamp;

function isInstructorBootcamp(item: SliderItem): item is InstructorBootcamp {
    return (item as any).status !== undefined || (item as any).type === "instructor_bootcamp";
}

function getBootcampTagline(slug: string): string {
    if (slug.includes("kids-clothing")) return "Launch a global brand from your laptop.";
    if (slug.includes("social-content") || slug.includes("agency")) return "Scale to $10k/mo with AI automation.";
    if (slug.includes("sleep-music") || slug.includes("youtube")) return "Build a passive income stream on YouTube.";
    return "Master this high-value skill.";
}

function FeaturedPromptSlider({ items }: { items: SliderItem[] }) {
    const [idx, setIdx] = useState(0);

    useEffect(() => {
        if (!items.length) return;
        const t = setInterval(() => {
            setIdx((prev) => (prev + 1) % items.length);
        }, 3500);
        return () => clearInterval(t);
    }, [items.length]);

    const active = items[idx];

    if (!active) {
        return (
            <div className="rounded-2xl border border-border bg-card p-4">
                <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-muted to-black/50" />
                <div className="mt-4 rounded-xl border border-border bg-popover p-3">
                    <p className="text-xs text-muted-foreground">Featured content</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Loading…</p>
                </div>
            </div>
        );
    }

    const isBootcamp = isInstructorBootcamp(active);

    const href = isBootcamp
        ? `/bootcamps/${encodeURIComponent(active.slug)}`
        : `/prompts/${encodeURIComponent(active.slug)}`;

    const bestImage = isBootcamp
        ? (active.featured_image_url ?? "")
        : (
            ((active as PublicPrompt).featured_image_url ?? "").trim() ||
            ((active as PublicPrompt).image_url ?? "").trim() ||
            ((active as PublicPrompt).media_url ?? "").trim()
        );

    const hasImage = bestImage.length > 0;

    // Labels
    const categoryLabel = isBootcamp ? "Instructor Led Bootcamp" : (active as PublicPrompt).category ?? "general";
    const bottomLabel = isBootcamp ? "Instructor Led Bootcamp" : "Featured prompt";
    const actionText = isBootcamp ? "Coming Soon" : "Open →";
    const actionColor = isBootcamp ? "text-muted-foreground/40" : "text-[#B7FF00]";
    const actionCursor = isBootcamp ? "cursor-default" : "cursor-pointer"; // But user said "remain clickable", so keep pointer? "appear disabled but remain clickable" -> styles disabled but link works.

    return (
        <div className="rounded-2xl border border-border bg-card p-4">
            <Link href={href} className={`block ${isBootcamp ? "cursor-pointer" : ""}`}>
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-black/40">
                    {hasImage ? (
                        <Image
                            src={bestImage}
                            alt={active.title}
                            fill
                            className="object-cover transition duration-300 opacity-90"
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority
                            unoptimized // Fix for local file loading issues in dev
                        />
                    ) : (
                        <div className="h-full w-full bg-black/50 brightness-[0.55]" />
                    )}

                    <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-white/85 uppercase">
                            {categoryLabel}
                        </span>

                        {!isBootcamp && String((active as PublicPrompt).access_level || "free").toLowerCase() === "premium" ? (
                            <span className="rounded-full border border-lime-400/30 bg-lime-400/15 px-3 py-1 text-[11px] text-lime-200">
                                PRO
                            </span>
                        ) : null}
                    </div>

                    {/* Bootcamp Enticing Summary Overlay - REMOVED */}
                </div>

                <div className="mt-4 rounded-xl border border-border bg-popover p-4">
                    <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 pr-4">
                            <p className="text-xs text-muted-foreground mb-1">{bottomLabel}</p>
                            <p className="truncate text-base font-bold text-foreground">{active.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${actionColor}`}>{actionText}</p>
                        </div>
                    </div>

                    {/* Tagline for Bootcamps */}
                    {isBootcamp && (
                        <p className="text-sm text-muted-foreground/70 line-clamp-2 leading-relaxed">
                            {getBootcampTagline(active.slug)}
                        </p>
                    )}
                </div>
            </Link>

            <div className="mt-3 flex items-center justify-center gap-1.5">
                {items.map((_, i) => (
                    <span
                        key={i}
                        className={[
                            "h-1.5 w-1.5 rounded-full border border-border",
                            i === idx ? "bg-[#B7FF00]" : "bg-muted-foreground/30",
                        ].join(" ")}
                    />
                ))}
            </div>
        </div>
    );
}

function Typewriter({ text, className = "", gradientWords = [] }: { text: string; className?: string; gradientWords?: string[] }) {
    const [visible, setVisible] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setVisible(true);
                observer.disconnect();
            }
        });
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    const [complete, setComplete] = useState(false);

    useEffect(() => {
        if (visible) {
            const totalChars = text.length;
            const duration = totalChars * 100 + 500;
            const t = setTimeout(() => setComplete(true), duration);
            return () => clearTimeout(t);
        }
    }, [visible, text]);

    const words = text.split(" ");

    return (
        <span ref={ref} className={className}>
            {words.map((word, wordIndex) => {
                const isGradient = gradientWords.includes(word);
                const previousChars = words.slice(0, wordIndex).join(" ").length + (wordIndex > 0 ? 1 : 0);

                return (
                    <span key={wordIndex}>
                        {word.split("").map((char, charIndex) => (
                            <span
                                key={charIndex}
                                className={`inline-block transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'} ${isGradient ? "text-transparent bg-clip-text bg-gradient-to-r from-[#B7FF00] to-green-400" : "text-foreground"}`}
                                style={{ transitionDelay: `${(previousChars + charIndex) * 100}ms` }}
                            >
                                {char}
                            </span>
                        ))}
                        {wordIndex < words.length - 1 && (
                            <span
                                className={`inline-block transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'}`}
                                style={{ transitionDelay: `${(previousChars + word.length) * 100}ms` }}
                            >&nbsp;</span>
                        )}
                    </span>
                );
            })}
            <span className={`inline-block ml-1 text-[#B7FF00] transition-opacity duration-1000 ${!complete ? "animate-pulse" : ""} ${visible && !complete ? 'opacity-100' : 'opacity-0'}`}>|</span>
        </span>
    );
}



// ... existing imports ...

// --- Main UI Component ---

type HomeFeedProps = {
    prompts: PublicPrompt[];
    instructorBootcamps?: InstructorBootcamp[];
    favoriteIds: string[]; // Set is not serializable
    recentRemixes?: RemixItem[];
};

export default function HomeFeed({ prompts, instructorBootcamps = [], favoriteIds, recentRemixes = [] }: HomeFeedProps) {
    const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

    // Tour Steps


    // Auth Logic for CTA
    const [user, setUser] = useState<any>(null);
    const [isPro, setIsPro] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(true);

    useEffect(() => {
        const supabase = createSupabaseBrowserClient();
        async function checkAuth() {
            setLoadingAuth(true);
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);

            if (user) {
                const { data: profile } = await supabase.from("profiles").select("plan, role, staff_pro").eq("user_id", user.id).single();
                if (profile) {
                    const plan = String(profile.plan || "free").toLowerCase();
                    const role = String(profile.role || "user").toLowerCase();
                    const staffPro = Boolean(profile.staff_pro);
                    const isStaffPlus = ["staff", "instructor", "editor", "admin", "super_admin"].includes(role);
                    const pro = plan === "premium" || staffPro || isStaffPlus;
                    setIsPro(pro);
                }
            }
            setLoadingAuth(false);
        }
        checkAuth();
    }, []);

    const sliderPrompts = useMemo(() => {
        const markedBootcamps = instructorBootcamps.map(b => ({ ...b, type: "instructor_bootcamp" } as InstructorBootcamp));
        // ONLY show instructor bootcamps in the slider as requested
        return markedBootcamps;
    }, [instructorBootcamps]);

    const trendingPrompts = useMemo(() => prompts, [prompts]); // Use all fetched prompts (already limited by server)

    // We are now Server Component based for initial data, so no loading state needed for initial content!
    // BUT we render client side so hydration happens.

    const themePrimary = "bg-[#B7FF00] text-black hover:opacity-90";
    const themeSecondary = "border border-border bg-secondary text-foreground hover:bg-accent";

    // Default (Loading or Pro): Browse is Primary
    let browseStyle = themePrimary;

    // If we have a dynamic Primary action (Sign Up or Upgrade), demote Browse
    if (!loadingAuth && (!user || (user && !isPro))) {
        browseStyle = themeSecondary;
    }

    return (
        <>

            {/* 1) HERO */}
            <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1.5 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B7FF00] opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B7FF00]"></span>
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#B7FF00]">NO TECHNICAL SKILLS REQUIRED</span>
                        </div>

                        <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground md:text-7xl">
                            <Typewriter text="AI Made Easy" gradientWords={["AI"]} />
                        </h1>

                        <h2 className="mt-6 text-3xl md:text-4xl font-black tracking-tight text-foreground">
                            Learn. Create. Grow.
                        </h2>

                        <p className="mt-6 max-w-xl text-lg font-semibold leading-relaxed text-muted-foreground md:text-xl">
                            We show you how to use AI to get more customers, make better content, and save time in your business.
                        </p>

                        {/* Search Bar */}
                        <div className="relative mt-8 w-full max-w-md">
                            <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search prompts (flyers, ads, product photos, thumbnails...)"
                                className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-white placeholder:text-muted-foreground focus:border-[#B7FF00]/50 focus:outline-none focus:ring-1 focus:ring-[#B7FF00]/50 transition-all"
                            />
                        </div>

                        {/* MOBILE ONLY: slider goes above CTA */}
                        <div className="mt-6 md:hidden">
                            {sliderPrompts.length > 0 ? (
                                <FeaturedPromptSlider items={sliderPrompts} />
                            ) : (
                                <div className="rounded-2xl border border-border bg-card p-4 text-muted-foreground text-xs">No featured bootcamps.</div>
                            )}
                        </div>

                        {/* CONTROLS */}
                        <div className="mt-6 flex flex-col sm:flex-row gap-4">
                            <Link
                                href="/prompts"
                                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-[#B7FF00] px-8 py-3.5 text-sm font-bold text-black hover:opacity-90 transition-opacity"
                            >
                                Browse Prompts <ArrowRight size={16} />
                            </Link>

                            <Link
                                href="/studio/creator"
                                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-8 py-3.5 text-sm font-bold text-white hover:bg-white/10 transition-colors"
                            >
                                Open Creator Studio <ArrowRight size={16} />
                            </Link>
                        </div>

                        {/* Footer Text */}
                        <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-muted-foreground">
                                <Star size={12} fill="currentColor" />
                            </div>
                            <span>Built for entrepreneurs and creators</span>
                        </div>
                    </div>

                    {/* DESKTOP ONLY: slider stays on right */}
                    <div className="hidden md:block">
                        {sliderPrompts.length > 0 ? (
                            <FeaturedPromptSlider items={sliderPrompts} />
                        ) : (
                            <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
                                Instructor-Led Bootcamps coming soon.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* 2) INSTRUCTOR-LED BOOTCAMPS (Slider in Hero now, so this might be empty or just the section I removed?) 
                Actually the helper comment says "Slider is now in Hero".
            */}

            {/* 3) AI BASICS COURSE (Moved Above) */}
            <BasicTrainingSection />

            {/* 4) WHAT YOU'LL LEARN */}
            <WhatYouWillLearnSection />

            {/* 5) PROMPT TEMPLATES */}
            <section className="mx-auto max-w-6xl px-4 py-12 md:py-16">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-border pb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B7FF00]/10 text-[#B7FF00]">
                                <Wand2 size={12} />
                            </span>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#B7FF00]">
                                Prompt Templates
                            </span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">
                            Free Templates
                        </h2>
                        <p className="text-lg text-muted-foreground max-w-2xl">
                            Pick a template, customize it for your business, and post it today.
                        </p>
                    </div>

                    <Link href="/prompts" className="group flex items-center gap-2 rounded-xl bg-card border border-border px-5 py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:border-[#B7FF00]/30 hover:text-[#B7FF00] shrink-0">
                        <span>Use Free Templates</span>
                        <ArrowRight size={16} className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#B7FF00]" />
                    </Link>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {trendingPrompts.length ? (
                        trendingPrompts.map((p) => (
                            <PromptCard
                                key={p.id}
                                id={p.id}
                                title={p.title}
                                summary={p.summary || ""}
                                slug={p.slug}
                                category={p.category || undefined}
                                accessLevel={p.access_level}
                                imageUrl={p.image_url || p.featured_image_url || p.media_url}
                                initialFavorited={favSet.has(p.id)}
                            />
                        ))
                    ) : (
                        <div className="text-sm text-muted-foreground col-span-4 py-8 text-center">No prompts found.</div>
                    )}
                </div>

                <div className="mt-6 flex justify-center md:hidden">
                    <Link href="/prompts" className="group flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:border-border/80">
                        <span>Use Free Templates</span>
                    </Link>
                </div>
            </section>

            {/* 5) COMMUNITY CREATIONS */}
            {recentRemixes && recentRemixes.length > 0 && (
                <section className="mx-auto max-w-6xl px-4 pb-12 md:pb-16">
                    <div className="mt-24 pt-8 border-t border-white/10">
                        {/* Mobile Layout */}
                        <div className="mb-6 md:hidden">
                            <div className="flex items-center gap-4 mb-3">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#B7FF00] text-black shadow-[0_0_20px_-5px_#B7FF00]">
                                    <RefreshCw size={24} strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-bold text-foreground">See What the Community Is&nbsp;Creating</h3>
                            </div>
                            <p className="text-muted-foreground">
                                See how our members are launching and growing their businesses with AI&nbsp;Skills&nbsp;Studio.
                                <br />
                                <span className="text-sm opacity-70">Get inspired, remix ideas, and create your own version in minutes.</span>
                            </p>
                        </div>

                        {/* Desktop Layout */}
                        <div className="mb-6 hidden md:flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#B7FF00] text-black shadow-[0_0_20px_-5px_#B7FF00]">
                                <RefreshCw size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-foreground mb-1">See What the Community Is&nbsp;Creating</h3>
                                <p className="text-muted-foreground">
                                    See how our members are launching and growing their businesses with AI&nbsp;Skills&nbsp;Studio.
                                    <br />
                                    <span className="text-sm opacity-70">Get inspired, remix ideas, and create your own version in minutes.</span>
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {recentRemixes.map((remix) => (
                                <RemixCard key={remix.id} item={remix} />
                            ))}
                        </div>

                        <div className="mt-8 flex justify-center">
                            <Link href="/feed" className="group flex items-center gap-2 rounded-full bg-[#B7FF00] px-8 py-3 text-sm font-bold text-black transition-all hover:opacity-90">
                                <span>Create Yours Now</span>
                                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* 6) SUCCESS STORIES */}
            <SuccessStories />

            {/* 7) FINAL CTA */}
            <section className="mx-auto max-w-6xl px-4 pb-24">
                <div className="rounded-3xl border border-white/10 bg-zinc-900/50 p-12 text-center backdrop-blur-sm">
                    <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
                        READY TO <span className="text-[#B7FF00]">CREATE</span>?
                    </h2>
                    <p className="mx-auto max-w-2xl text-lg text-white/60 mb-10">
                        Start with free prompts. Upgrade for Pro prompts and the fastest workflow for content production.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                        <Link href="/prompts" className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors">
                            Browse Prompts
                        </Link>
                        <Link href="/studio/creator" className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors">
                            Open Creator Studio
                        </Link>
                        {!user && (
                            <Link href="/signup" className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#B7FF00] text-black font-bold hover:opacity-90 transition-opacity">
                                Sign Up
                            </Link>
                        )}
                    </div>
                    <p className="text-xs text-white/30">Free tier available. Upgrade anytime.</p>
                </div>
            </section>
        </>
    );
}

