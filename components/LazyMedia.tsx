import { useInView } from "@/hooks/useInView";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";

type LazyMediaProps = {
    src: string;
    poster?: string | null;
    alt?: string;
    type: "video" | "image";
    className?: string;
    unoptimized?: boolean;
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
                    <VideoPlayer
                        src={src}
                        poster={poster}
                        className="absolute inset-0 w-full h-full object-cover"
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

function VideoPlayer({ src, poster, className }: { src: string, poster?: string | null, className?: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Force play on mount (essential for mobile when injected dynamically)
        const attemptPlay = () => {
            if (video.paused) {
                video.play().catch(() => {
                    // Autoplay blocked, maybe muted issue?
                    // Ensure muted is set (it is in props)
                });
            }
        };

        attemptPlay();

        // Also try again on any touch for iOS low-power mode if stuck
        const onTouch = () => {
            if (video.paused) attemptPlay();
        };
        window.addEventListener('touchstart', onTouch, { once: true, passive: true });

        return () => {
            window.removeEventListener('touchstart', onTouch);
        };
    }, []);

    return (
        <video
            ref={videoRef}
            src={src}
            poster={poster || undefined}
            className={className}
            autoPlay
            muted
            loop
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
        />
    );
}
