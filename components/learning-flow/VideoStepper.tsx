"use client";

import { useState, useMemo, useEffect } from "react";
import { Play, Check, ChevronRight, Clock } from "lucide-react";

type Video = {
    id: string;
    video_url: string;
    title: string | null;
    description?: string | null;
    order_index: number;
    duration_seconds: number;
    thumbnail_url?: string | null;
};

type Props = {
    videos: Video[];
    lessonId: string;
    onAllWatched?: () => void;
};

// Extract video embed URL
function getEmbedUrl(url: string): string {
    // YouTube
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?\/]+)/);
        if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
    }

    // Vimeo
    if (url.includes("vimeo.com")) {
        const match = url.match(/vimeo\.com\/(\d+)/);
        if (match) return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;
    }

    // Direct video URLs
    return url;
}

function isDirectVideo(url: string): boolean {
    return url.match(/\.(mp4|webm|mov|m3u8)(\?|$)/i) !== null;
}

export default function VideoStepper({ videos, lessonId, onAllWatched }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [watchedIndexes, setWatchedIndexes] = useState<Set<number>>(new Set());

    // "Next Up" State
    const [showNextUp, setShowNextUp] = useState(false);
    const [countdown, setCountdown] = useState(5);

    const sortedVideos = useMemo(() => {
        return [...videos].sort((a, b) => a.order_index - b.order_index);
    }, [videos]);

    const currentVideo = sortedVideos[currentIndex];
    const totalDuration = sortedVideos.reduce((sum, v) => sum + v.duration_seconds, 0);
    const allWatched = watchedIndexes.size === sortedVideos.length;

    // Reset next-up state when video changes
    useEffect(() => {
        setShowNextUp(false);
        setCountdown(5);
    }, [currentIndex]);

    // Countdown Timer
    useEffect(() => {
        if (!showNextUp || countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [showNextUp, countdown]);

    // Auto-advance when countdown hits 0
    useEffect(() => {
        if (countdown === 0 && showNextUp) {
            handleVideoEnd();
        }
    }, [countdown, showNextUp]);

    async function handleVideoEnd() {
        const newWatched = new Set(watchedIndexes);
        if (!newWatched.has(currentIndex)) {
            newWatched.add(currentIndex);
            setWatchedIndexes(newWatched);

            // Save progress
            try {
                await fetch("/api/learn/progress", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lesson_id: lessonId,
                        video_index: currentIndex,
                        is_completed: true
                    })
                });
                // Ideally trigger toast or XP animation here
            } catch (e) {
                console.error("Failed to save progress", e);
            }
        }

        // Auto-advance to next unwatched video
        if (currentIndex < sortedVideos.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }

        // Check if all watched
        if (newWatched.size === sortedVideos.length && onAllWatched) {
            onAllWatched();
        }
    }

    function markAsWatched() {
        const newWatched = new Set(watchedIndexes);
        newWatched.add(currentIndex);
        setWatchedIndexes(newWatched);

        if (newWatched.size === sortedVideos.length && onAllWatched) {
            onAllWatched();
        }
    }

    if (sortedVideos.length === 0) {
        return (
            <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-8 text-center text-white/40">
                No videos available for this mission.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Progress Header */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-[#B7FF00]">
                        Video {currentIndex + 1} of {sortedVideos.length}
                    </span>
                    <span className="text-white/40">
                        {watchedIndexes.size}/{sortedVideos.length} watched
                    </span>
                </div>
                <div className="flex items-center gap-1 text-white/40">
                    <Clock size={14} />
                    <span>{Math.ceil(totalDuration / 60)} min total</span>
                </div>
            </div>

            {/* Video Steps */}
            <div className="flex gap-2 mb-4">
                {sortedVideos.map((video, index) => (
                    <button
                        key={video.id || index}
                        onClick={() => setCurrentIndex(index)}
                        className={`flex-1 h-1.5 rounded-full transition-all ${index === currentIndex
                            ? "bg-[#B7FF00]"
                            : watchedIndexes.has(index)
                                ? "bg-[#B7FF00]/40"
                                : "bg-white/10"
                            }`}
                        title={video.title || `Video ${index + 1}`}
                    />
                ))}
            </div>

            {/* Current Video Player */}
            <div className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 aspect-video">
                <div className="absolute inset-0 bg-black">
                    {isDirectVideo(currentVideo.video_url) ? (
                        <video
                            key={currentVideo.id}
                            src={currentVideo.video_url}
                            controls={!showNextUp} // Hide controls when overlay is active? Maybe just keep them.
                            onEnded={handleVideoEnd}
                            onTimeUpdate={(e) => {
                                const { currentTime, duration } = e.currentTarget;
                                // Show "Next Up" when 5s remaining
                                if (
                                    duration - currentTime <= 5 &&
                                    !showNextUp &&
                                    currentIndex < sortedVideos.length - 1
                                ) {
                                    setShowNextUp(true);
                                }
                            }}
                            className="w-full h-full"
                            playsInline
                            autoPlay={currentIndex > 0} // Autoplay subsequent videos
                        />
                    ) : (
                        <iframe
                            key={currentVideo.id}
                            src={getEmbedUrl(currentVideo.video_url)}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    )}
                </div>

                {/* "Next Up" Overlay */}
                {showNextUp && currentIndex < sortedVideos.length - 1 && (
                    <div className="absolute bottom-4 right-4 z-10 max-w-sm rounded-xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in">
                        <div className="flex items-start gap-4">
                            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-black">
                                {sortedVideos[currentIndex + 1].thumbnail_url ? (
                                    <img
                                        src={sortedVideos[currentIndex + 1].thumbnail_url!}
                                        className="h-full w-full object-cover opacity-50"
                                        alt=""
                                    />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-white/5">
                                        <Play size={20} className="text-white/20" />
                                    </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="font-mono text-xl font-bold text-white">{countdown}</span>
                                </div>
                                <svg className="absolute inset-0 h-full w-full -rotate-90">
                                    <circle
                                        cx="50%"
                                        cy="50%"
                                        r="20"
                                        fill="none"
                                        stroke="#B7FF00"
                                        strokeWidth="4"
                                        strokeDasharray="126"
                                        strokeDashoffset={126 - (126 * (5 - countdown)) / 5}
                                        className="transition-all duration-1000 ease-linear"
                                    />
                                </svg>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium uppercase text-white/50 mb-1">Up Next</p>
                                <h4 className="font-bold text-sm truncate text-white mb-3">
                                    {sortedVideos[currentIndex + 1].title || `Video ${currentIndex + 2}`}
                                </h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowNextUp(false)}
                                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleVideoEnd(); // Advance immediately
                                        }}
                                        className="rounded-lg bg-[#B7FF00] px-3 py-1.5 text-xs font-medium text-black hover:bg-[#a3e600]"
                                    >
                                        Play Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Video Info (Overlay when controls inactive? No, keep it separate below) */}
            </div>

            <div className="hidden">
                {/* Hack to preload next video? No need, browser handles it */}
            </div>

            <div className="p-4 border border-white/10 rounded-xl bg-zinc-900/50">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="font-semibold mb-1">
                            {currentVideo.title || `Video ${currentIndex + 1}`}
                        </h3>
                        {currentVideo.description && (
                            <p className="text-sm text-white/60">{currentVideo.description}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-white/40">
                            {currentVideo.duration_seconds}s
                        </span>
                        {watchedIndexes.has(currentIndex) ? (
                            <div className="flex items-center gap-1 text-[#B7FF00] text-xs">
                                <Check size={14} />
                                Watched
                            </div>
                        ) : (
                            <button
                                onClick={markAsWatched}
                                className="text-xs text-white/50 hover:text-white transition"
                            >
                                Mark as watched
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Video List (collapsed view) */}
            <div className="space-y-1">
                {sortedVideos.map((video, index) => (
                    <button
                        key={video.id || index}
                        onClick={() => setCurrentIndex(index)}
                        className={`w-full flex items-center gap-3 rounded-lg p-2 text-left transition ${index === currentIndex
                            ? "bg-[#B7FF00]/10 border border-[#B7FF00]/30"
                            : "hover:bg-white/5"
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${watchedIndexes.has(index)
                            ? "bg-[#B7FF00]/20 text-[#B7FF00]"
                            : index === currentIndex
                                ? "bg-[#B7FF00] text-black"
                                : "bg-white/10 text-white/50"
                            }`}>
                            {watchedIndexes.has(index) ? (
                                <Check size={14} />
                            ) : (
                                <Play size={14} />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                                {video.title || `Video ${index + 1}`}
                            </div>
                            <div className="text-xs text-white/40">
                                {video.duration_seconds}s
                            </div>
                        </div>

                        {index === currentIndex && (
                            <div className="text-xs text-[#B7FF00] font-medium">
                                Playing
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* All Watched Banner */}
            {allWatched && (
                <div className="rounded-xl border border-[#B7FF00]/30 bg-[#B7FF00]/10 p-4 text-center">
                    <Check size={20} className="mx-auto text-[#B7FF00] mb-2" />
                    <p className="text-sm font-medium text-[#B7FF00]">
                        Great job! You've watched all videos.
                    </p>
                    <p className="text-xs text-white/50 mt-1">
                        Now it's time to create!
                    </p>
                </div>
            )}
        </div>
    );
}
