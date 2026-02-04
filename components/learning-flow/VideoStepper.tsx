"use client";

import { useState, useMemo } from "react";
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

export default function VideoStepper({ videos, onAllWatched }: Props) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [watchedIndexes, setWatchedIndexes] = useState<Set<number>>(new Set());

    const sortedVideos = useMemo(() => {
        return [...videos].sort((a, b) => a.order_index - b.order_index);
    }, [videos]);

    const currentVideo = sortedVideos[currentIndex];
    const totalDuration = sortedVideos.reduce((sum, v) => sum + v.duration_seconds, 0);
    const allWatched = watchedIndexes.size === sortedVideos.length;

    function handleVideoEnd() {
        const newWatched = new Set(watchedIndexes);
        newWatched.add(currentIndex);
        setWatchedIndexes(newWatched);

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
            <div className="rounded-2xl overflow-hidden bg-zinc-900 border border-white/10">
                <div className="relative aspect-video w-full bg-black">
                    {isDirectVideo(currentVideo.video_url) ? (
                        <video
                            key={currentVideo.id}
                            src={currentVideo.video_url}
                            controls
                            onEnded={handleVideoEnd}
                            className="w-full h-full"
                            autoPlay
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

                {/* Video Info */}
                <div className="p-4 border-t border-white/10">
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
