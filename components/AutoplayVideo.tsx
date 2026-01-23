"use client";

import { useEffect, useRef } from "react";

interface AutoplayVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    src: string;
    threshold?: number; // Visibility threshold (0.0 to 1.0) required to play
}

export default function AutoplayVideo({
    src,
    threshold = 0.5,
    className,
    poster,
    ...props
}: AutoplayVideoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                const video = videoRef.current;
                if (!video) return;

                if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    const playPromise = video.play();
                    if (playPromise !== undefined) {
                        playPromise.catch((e) => console.debug("Autoplay blocked", e));
                    }
                } else {
                    video.pause();
                }
            },
            {
                threshold: [0.0, 0.5]
            }
        );

        if (videoRef.current) {
            observer.observe(videoRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <video
            ref={videoRef}
            src={src}
            className={className}
            muted
            loop
            playsInline
            poster={poster}
            {...props}
        />
    );
}
