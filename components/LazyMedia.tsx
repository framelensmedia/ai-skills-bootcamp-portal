import { useInView } from "@/hooks/useInView";
import Image from "next/image";
import { useState } from "react";

type LazyMediaProps = {
    src: string;
    poster?: string | null;
    alt?: string;
    type: "video" | "image";
    className?: string;
    unoptimized?: boolean; // Keep for backward compat if needed, but we prefer false
};

export default function LazyMedia({ src, poster, alt = "", type, className, unoptimized = false }: LazyMediaProps) {
    const { ref, isInView } = useInView({ threshold: 0.1, rootMargin: "200px 0px" });
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div ref={ref} className={`relative w-full h-full bg-zinc-900 overflow-hidden ${className}`}>
            {type === "video" ? (
                // Video Logic: Only render <video> tag if in view. 
                // Render Poster if out of view or waiting.
                isInView ? (
                    <video
                        src={src}
                        poster={poster || undefined}
                        className="absolute inset-0 w-full h-full object-cover"
                        autoPlay
                        muted
                        loop
                        playsInline
                    />
                ) : (
                    // Placeholder / Poster
                    poster ? (
                        <Image
                            src={poster}
                            alt={alt}
                            fill
                            className="object-cover opacity-60"
                            unoptimized={unoptimized}
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20">Video</div>
                    )
                )
            ) : (
                // Image Logic: Use Next.js Image Priority/Lazy handling naturally, 
                // OR enforce strict DOM injection.
                // Let's enforce strict DOM injection for extreme memory saving on lists of 100s.
                isInView ? (
                    <Image
                        src={src}
                        alt={alt}
                        fill
                        className="object-cover transition-opacity duration-500"
                        onLoad={() => setIsLoaded(true)}
                        unoptimized={unoptimized}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                ) : (
                    <div className="absolute inset-0 bg-white/5 animate-pulse" />
                )
            )}
        </div>
    );
}
