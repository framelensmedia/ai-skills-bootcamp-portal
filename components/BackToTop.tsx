"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function BackToTop() {
    // Wrapper to keep file logic clean if we expand later
    return <BackToTopContent />;
}

function BackToTopContent() {
    const [isScrolling, setIsScrolling] = useState(false);
    const [scrolledPast, setScrolledPast] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const handleScroll = () => {
            const isPast = window.scrollY > 300;
            setScrolledPast(isPast);

            if (isPast) {
                // If we are past the point, we are technically "scrolling" or "active"
                // But we want to detect ACTIVITY.
                setIsScrolling(true);
                clearTimeout(timeout);
                timeout = setTimeout(() => setIsScrolling(false), 1200);
            } else {
                setIsScrolling(false);
            }
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Visible if:
    // 1. We are scrolled down past 300px (scrolledPast)
    // AND
    // 2. Either we are actively scrolling (isScrolling) OR we are hovering the button (isHovered)
    const visible = scrolledPast && (isScrolling || isHovered);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <button
            onClick={scrollToTop}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`fixed bottom-8 left-8 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-black border border-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-500 hover:bg-white/10 hover:border-white/40 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
                } animate-border-pulse`}
            aria-label="Back to top"
        >
            <ArrowUp size={24} />
        </button>
    );
}
