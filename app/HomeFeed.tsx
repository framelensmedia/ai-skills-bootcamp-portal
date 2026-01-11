"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import PromptCard from "@/components/PromptCard";
import { Wand2 } from "lucide-react";
import Image from "next/image";
import BasicTrainingSection from "@/components/home/BasicTrainingSection";
import BasicTrainingCards from "@/components/home/BasicTrainingCards";

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
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20">
            <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/40" />
            <p className="mt-4 text-xs font-semibold text-[#B7FF00]">
                {tag}{" "}
                {comingSoon ? (
                    <span className="ml-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/60">
                        COMING SOON
                    </span>
                ) : null}
            </p>
            <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm text-white/60">{desc}</p>
            <div className="mt-4">
                <span className="text-xs text-white/60 hover:text-white">
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/50" />
                <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
                    <p className="text-xs text-white/60">Featured content</p>
                    <p className="mt-1 text-sm font-semibold text-white">Loading…</p>
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
    const actionColor = isBootcamp ? "text-white/40" : "text-[#B7FF00]";
    const actionCursor = isBootcamp ? "cursor-default" : "cursor-pointer"; // But user said "remain clickable", so keep pointer? "appear disabled but remain clickable" -> styles disabled but link works.

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <Link href={href} className={`block ${isBootcamp ? "cursor-pointer" : ""}`}>
                <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-white/10 bg-black/40">
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

                <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4">
                    <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 pr-4">
                            <p className="text-xs text-white/60 mb-1">{bottomLabel}</p>
                            <p className="truncate text-base font-bold text-white">{active.title}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className={`text-sm font-semibold ${actionColor}`}>{actionText}</p>
                        </div>
                    </div>

                    {/* Tagline for Bootcamps */}
                    {isBootcamp && (
                        <p className="text-sm text-white/70 line-clamp-2 leading-relaxed">
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
                            "h-1.5 w-1.5 rounded-full border border-white/10",
                            i === idx ? "bg-[#B7FF00]" : "bg-white/20",
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
                                className={`inline-block transition-opacity duration-100 ${visible ? 'opacity-100' : 'opacity-0'} ${isGradient ? "text-transparent bg-clip-text bg-gradient-to-r from-[#B7FF00] to-green-400" : "text-white"}`}
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

// --- Main UI Component ---

type HomeFeedProps = {
    prompts: PublicPrompt[];
    instructorBootcamps?: InstructorBootcamp[];
    favoriteIds: string[]; // Set is not serializable
};

export default function HomeFeed({ prompts, instructorBootcamps = [], favoriteIds }: HomeFeedProps) {
    const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

    const sliderPrompts = useMemo(() => {
        const markedBootcamps = instructorBootcamps.map(b => ({ ...b, type: "instructor_bootcamp" } as InstructorBootcamp));
        // ONLY show instructor bootcamps in the slider as requested
        return markedBootcamps;
    }, [instructorBootcamps]);

    const trendingPrompts = useMemo(() => prompts, [prompts]); // Use all fetched prompts (already limited by server)

    // We are now Server Component based for initial data, so no loading state needed for initial content!
    // BUT we render client side so hydration happens.

    return (
        <>
            {/* HERO */}
            <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-[#B7FF00]/20 bg-[#B7FF00]/5 px-3 py-1.5 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#B7FF00] opacity-75"></span>
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#B7FF00]"></span>
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#B7FF00]">No technical skills required</span>
                        </div>

                        <h1 className="mt-6 text-5xl font-bold tracking-tight text-white md:text-7xl">
                            <Typewriter text="AI Made Easy" gradientWords={["AI"]} />
                        </h1>

                        <p className="mt-6 max-w-xl text-lg font-semibold leading-relaxed text-white/60 md:text-xl">
                            The all-in-one platform to launch your business with AI, and master the skills.
                        </p>

                        {/* MOBILE ONLY: slider goes above search/CTA */}
                        <div className="mt-6 md:hidden">
                            {sliderPrompts.length > 0 ? (
                                <FeaturedPromptSlider items={sliderPrompts} />
                            ) : (
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/50 text-xs">No featured prompts.</div>
                            )}
                        </div>

                        {/* CONTROLS */}
                        <div className="mt-6 max-w-xl">
                            {/* Search (full width) */}
                            <div className="mb-4 flex w-full items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-3">
                                <span className="text-xs text-white/60">🔎</span>
                                <input
                                    className="w-full bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
                                    placeholder="Search prompts (flyers, ads, product photos, thumbnails...)"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            window.location.href = `/prompts?q=${encodeURIComponent(e.currentTarget.value)}`;
                                        }
                                    }}
                                />
                            </div>

                            {/* CTA Row (matches search width exactly) */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Link
                                    href="/prompts"
                                    className="inline-flex w-full items-center justify-center rounded-md bg-[#B7FF00] px-6 py-4 text-sm font-semibold text-black hover:opacity-90"
                                >
                                    Browse Prompts →
                                </Link>

                                <Link
                                    href="/studio"
                                    className="inline-flex w-full items-center justify-center rounded-md border border-white/15 bg-white/5 px-6 py-4 text-sm font-semibold text-white hover:bg-white/10"
                                >
                                    Open Prompt Studio →
                                </Link>
                            </div>
                        </div>


                        <div className="mt-5 flex items-center gap-3 text-xs text-white/60">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                                ★
                            </span>
                            Built for entrepreneurs and creators
                        </div>
                    </div>

                    {/* DESKTOP ONLY: slider stays on right */}
                    <div className="hidden md:block">
                        {sliderPrompts.length > 0 ? (
                            <FeaturedPromptSlider items={sliderPrompts} />
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/50 text-xs">No featured prompts.</div>
                        )}
                    </div>
                </div>
            </section>

            {/* BASIC TRAINING - Inserted after hero */}
            <BasicTrainingSection />

            {/* TRENDING PROMPTS */}
            <section className="mx-auto max-w-6xl px-4 py-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B7FF00]/10 text-[#B7FF00]">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Trending Prompts</h2>
                            <div className="mt-2 inline-flex items-center gap-2 rounded-2xl rounded-br-none border border-white/10 bg-[#1A1A1A] px-3 py-1.5 text-xs font-medium text-white shadow-sm ring-1 ring-white/5">
                                <Wand2 className="h-3.5 w-3.5 text-lime-400" />
                                <span>Create pro level content by remixing one of the prompts</span>
                            </div>
                        </div>
                    </div>

                    <Link href="/prompts" className="group hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20">
                        <span>View More Prompts</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/50 transition-transform group-hover:translate-x-0.5 group-hover:text-white">
                            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                        </svg>
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
                        <div className="text-sm text-white/60 col-span-4 py-8 text-center">No prompts found.</div>
                    )}
                </div>

                <div className="mt-8 flex justify-center md:hidden">
                    <Link href="/prompts" className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20">
                        <span>View More Prompts</span>
                    </Link>
                </div>
            </section>

            {/* BASIC TRAINING MODULES - Repurposed Tutorials section */}
            <section className="mx-auto max-w-6xl px-4 pt-20 pb-10 md:pt-32 md:pb-14">
                <div className="text-center">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00]">Learn the system</p>
                    <h2 className="mt-2 text-2xl font-bold md:text-3xl">Basic Training Modules</h2>
                    <p className="mt-2 text-sm text-white/60">Master AI creation with these free guided missions.</p>
                </div>

                <div className="mt-6">
                    <BasicTrainingCards />
                </div>
            </section>

            {/* TESTIMONIAL STRIP */}
            <section className="mx-auto max-w-6xl px-4 pb-10 md:pb-14">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center md:p-10">
                    <p className="text-sm text-white/70">
                        “I stopped guessing and started executing. The prompts and remix tool paid for themselves fast.”
                    </p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                        Member, AI Skills Bootcamp
                    </p>
                </div>
            </section>

            {/* FINAL CTA */}
            <section className="mx-auto max-w-6xl px-4 pb-14">
                <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/5 to-black p-6 text-center md:p-10">
                    <h2 className="text-2xl font-black md:text-4xl">
                        READY TO <span className="text-[#B7FF00]">CREATE?</span>
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-sm text-white/70 md:text-base">
                        Start with free prompts. Upgrade for Pro prompts and the fastest workflow for content production.
                    </p>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Link
                            href="/prompts"
                            className="inline-flex w-full justify-center rounded-md bg-[#B7FF00] px-5 py-3 text-sm font-semibold text-black hover:opacity-90 sm:w-auto"
                        >
                            Browse Prompts
                        </Link>
                        <Link
                            href="/studio"
                            className="inline-flex w-full justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
                        >
                            Open Prompt Studio
                        </Link>
                        <Link
                            href="/pricing"
                            className="inline-flex w-full justify-center rounded-md border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
                        >
                            Upgrade to Pro
                        </Link>
                    </div>
                    <p className="mt-4 text-xs text-white/50">Free tier available. Upgrade anytime.</p>
                </div>
            </section>
        </>
    );
}
