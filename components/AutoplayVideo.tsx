"use client";

import { useEffect, useRef, useState } from "react";

interface AutoplayVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    src: string;
    threshold?: number;
}

export default function AutoplayVideo({
    src,
    threshold = 0.3, // Lower threshold for mobile
    className,
    poster,
    ...props
}: AutoplayVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasInteracted, setHasInteracted] = useState(false);

    // iOS requires user interaction before video can play
    // Listen for any interaction on the page
    useEffect(() => {
        const handleInteraction = () => {
            setHasInteracted(true);
            // Try to play all videos after first interaction
            document.querySelectorAll("video").forEach((v) => {
                if (v.paused && v.muted) {
                    v.play().catch(() => { });
                }
            });
        };

        if (!hasInteracted) {
            window.addEventListener("touchstart", handleInteraction, { once: true, passive: true });
            window.addEventListener("click", handleInteraction, { once: true });
            window.addEventListener("scroll", handleInteraction, { once: true, passive: true });
        }

        return () => {
            window.removeEventListener("touchstart", handleInteraction);
            window.removeEventListener("click", handleInteraction);
            window.removeEventListener("scroll", handleInteraction);
        };
    }, [hasInteracted]);

    // IntersectionObserver for play/pause based on visibility
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
                    // Attempt to play
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch(() => {
                            // Autoplay blocked - this is fine, user will need to interact
                        });
                    }
                } else {
                    video.pause();
                }
            },
            {
                threshold: [0.0, threshold, 0.5, 1.0],
                rootMargin: "50px" // Start loading a bit before visible
            }
        );

        observer.observe(video);

        return () => observer.disconnect();
    }, [threshold]);

    return (
        <video
            ref={videoRef}
            src={src}
            className={className}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={poster}
            // Webkit-specific attributes for iOS
            webkit-playsinline="true"
            x-webkit-airplay="allow"
            {...props}
        />
    );
}

