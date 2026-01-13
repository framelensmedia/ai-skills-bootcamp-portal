"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Sparkles, Layers } from "lucide-react";

type Pack = {
    id: string;
    pack_name: string;
    pack_description: string;
    thumbnail_url: string | null;
    category: string | null;
    access_level: string | null;
    slug: string;
    template_count: number;
};

export default function PackCarousel({ packs }: { packs: Pack[] }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);

    // Track scroll for animation effects
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const handleScroll = () => {
            const { scrollLeft, scrollWidth, clientWidth } = el;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        };

        el.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll(); // Init
        return () => el.removeEventListener("scroll", handleScroll);
    }, []);

    const scroll = (direction: "left" | "right") => {
        if (!scrollRef.current) return;
        const scrollAmount = scrollRef.current.clientWidth * 0.6;
        scrollRef.current.scrollBy({
            left: direction === "left" ? -scrollAmount : scrollAmount,
            behavior: "smooth",
        });
    };

    // Show placeholder cards if no packs
    const displayPacks = packs.length > 0 ? packs : Array(6).fill(null).map((_, i) => ({
        id: `placeholder-${i}`,
        pack_name: "Future Collection",
        pack_description: "New AI models generating...",
        thumbnail_url: null,
        category: "Coming Soon",
        access_level: "free",
        slug: "#",
        template_count: 0,
    }));

    return (
        <div className="relative group/carousel">
            {/* Dynamic Background Glow behind active area - simulated */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 bg-[#B7FF00]/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="mb-6 flex items-center justify-between px-2">
                {/* Title moved to parent usually, but controls here */}
                <div className="flex-1" /> {/* Spacer */}
                <div className="flex gap-2">
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
                className="flex gap-6 overflow-x-auto pb-12 pt-4 px-4 sm:px-0 scrollbar-hide snap-x snap-mandatory"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {displayPacks.map((pack) => (
                    <Link
                        key={pack.id}
                        href={pack.slug === "#" ? "#" : `/prompts/packs/${pack.slug}`}
                        className="group relative flex-shrink-0 snap-center 
              w-[75%] sm:w-[45%] md:w-[35%] lg:w-[28%] xl:w-[22%] 
              transition-all duration-500 ease-out"
                    >
                        {/* The Card Container */}
                        <div className="relative aspect-[5/6] overflow-hidden rounded-[2rem] bg-zinc-900 border border-white/10 shadow-2xl transition-all duration-500 group-hover:scale-105 group-hover:shadow-[#B7FF00]/20 group-hover:border-[#B7FF00]/40">

                            {/* Image */}
                            {pack.thumbnail_url ? (
                                <Image
                                    src={pack.thumbnail_url}
                                    alt={pack.pack_name}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    unoptimized
                                />
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center">
                                    <Layers className="w-16 h-16 text-white/10 group-hover:text-[#B7FF00]/50 transition-colors" />
                                </div>
                            )}

                            {/* Overlay Gradient for Text Readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />

                            {/* Content */}
                            <div className="absolute inset-0 flex flex-col justify-end p-6">
                                {/* Floating Badge */}
                                <div className="absolute top-4 right-4 translate-y-[-10px] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                                    <span className="rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/10 px-3 py-1 text-xs font-bold text-[#B7FF00] backdrop-blur-md">
                                        VIEW PACK
                                    </span>
                                </div>

                                {/* Pro Badge */}
                                {pack.access_level === "premium" && (
                                    <div className="absolute top-4 left-4">
                                        <span className="rounded-full border border-purple-500/30 bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-300 backdrop-blur-md">
                                            PRO
                                        </span>
                                    </div>
                                )}

                                <div className="transform transition-transform duration-300 group-hover:-translate-y-2">
                                    <div className="flex items-center gap-2 mb-2 opacity-80">
                                        <Sparkles className="w-3 h-3 text-[#B7FF00]" />
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-[#B7FF00]">
                                            {pack.template_count || 0} Templates
                                        </span>
                                    </div>

                                    <h3 className="text-2xl font-bold text-white leading-tight mb-2 group-hover:text-[#B7FF00] transition-colors">
                                        {pack.pack_name}
                                    </h3>

                                    <p className="text-sm text-white/60 line-clamp-2 leading-relaxed group-hover:text-white/80">
                                        {pack.pack_description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}

                {/* Spacer for right side scrolling */}
                <div className="w-[5vw] flex-shrink-0" />
            </div>

            <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
        </div>
    );
}
