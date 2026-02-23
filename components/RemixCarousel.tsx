"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import RemixCard, { RemixItem } from "./RemixCard";

export default function RemixCarousel({ remixes, user }: { remixes: RemixItem[], user?: any }) {
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

    if (!remixes || remixes.length === 0) return null;

    return (
        <div className="relative group/carousel">
            {/* Dynamic Background Glow behind active area - simulated */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 bg-[#B7FF00]/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="mb-4 flex items-center justify-between px-2 md:-mt-12 relative z-10 pointer-events-none">
                {/* Title moved to parent usually, but controls here */}
                <div className="flex-1" /> {/* Spacer */}
                <div className="hidden md:flex gap-2 pointer-events-auto">
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
                className="flex gap-4 overflow-x-auto pb-12 pt-4 px-4 sm:px-0 scrollbar-hide snap-x snap-mandatory"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
                {remixes.map((remix) => (
                    <div
                        key={remix.id}
                        className="relative flex-shrink-0 snap-center w-[75%] sm:w-[45%] md:w-[30%] lg:w-[25%] transition-all duration-500 ease-out"
                    >
                        <RemixCard item={remix} />
                    </div>
                ))}

                {/* View All CTA Card */}
                <div className="relative flex-shrink-0 snap-center w-[75%] sm:w-[45%] md:w-[30%] lg:w-[25%] transition-all duration-500 ease-out flex items-stretch">
                    <a
                        href={user ? "/feed" : "/signup"}
                        className="w-full flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#B7FF00]/40 hover:bg-white/10 transition-all duration-300 p-8 text-center group"
                    >
                        <div className="w-16 h-16 rounded-full bg-[#B7FF00]/10 flex items-center justify-center text-[#B7FF00] group-hover:scale-110 transition-transform">
                            <ChevronRight size={32} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-[#B7FF00] transition-colors">View All Remixes</h3>
                            <p className="text-sm text-white/50">Explore the full community feed</p>
                        </div>
                    </a>
                </div>

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
