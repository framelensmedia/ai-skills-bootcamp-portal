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
    const { ref, isInView } = useInView({ threshold: 0.1, rootMargin: "200px 0px" }, true);
    const [isLoaded, setIsLoaded] = useState(false);

    // Resolve the effective source — prefer src, fall back to poster for videos
    const effectiveSrc = src || (type === "video" ? poster : null) || null;

    return (
        <div ref={ref} className={`relative w-full h-full bg-zinc-900 overflow-hidden ${className}`}>
            {type === "video" ? (
                isInView && effectiveSrc ? (
                    <VideoPlayer
                        src={effectiveSrc}
                        poster={poster}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
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
                effectiveSrc ? (
                    isInView ? (
                        <Image
                            src={effectiveSrc}
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

        // Explicitly load and play
        const attemptPlay = () => {
            video.load(); // Force source refresh
            if (video.paused) {
                video.play().catch(() => {});
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
            poster={poster || undefined}
            className={className}
            autoPlay
            muted
            loop
            playsInline
            // @ts-ignore
            webkit-playsinline="true"
            preload="auto"
            crossOrigin="anonymous"
        >
            <source src={src} type="video/mp4" />
        </video>
    );
}
