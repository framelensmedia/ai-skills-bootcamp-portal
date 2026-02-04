"use client";

import { useEffect, useState } from "react";
import { ArrowBigUp } from "lucide-react";

export default function GalleryBackToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Show if scrolled past approx 500px
            setVisible(window.scrollY > 500);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return (
        <button
            onClick={scrollToTop}
            className={`pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-black border border-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all duration-500 hover:bg-white/10 hover:border-white/40 hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
                } animate-border-pulse`}
            aria-label="Back to top"
        >
            <ArrowBigUp size={24} />
        </button>
    );
}
