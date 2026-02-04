"use client";

import { Lesson } from "@/lib/types/learning-flow";
import { Play, FileText, Clock } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import VideoStepper from "./VideoStepper";

type Video = {
    id: string;
    video_url: string;
    title: string | null;
    description?: string | null;
    order_index: number;
    duration_seconds: number;
    thumbnail_url?: string | null;
};

type LessonContentProps = {
    lesson: Lesson & { videos?: Video[] };
    onVideosWatched?: () => void;
};

export default function LessonContent({ lesson, onVideosWatched }: LessonContentProps) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [videos, setVideos] = useState<Video[]>(lesson.videos || []);
    const [loadingVideos, setLoadingVideos] = useState(!lesson.videos);

    // Load videos if not passed as prop
    useEffect(() => {
        if (!lesson.videos && lesson.id) {
            loadVideos();
        }
    }, [lesson.id]);

    async function loadVideos() {
        try {
            const { data } = await supabase
                .from("lesson_videos")
                .select("*")
                .eq("lesson_id", lesson.id)
                .eq("is_published", true)
                .order("order_index", { ascending: true });

            if (data && data.length > 0) {
                setVideos(data);
            }
        } catch (e) {
            console.error("Failed to load videos:", e);
        } finally {
            setLoadingVideos(false);
        }
    }

    // If we have multiple videos, use VideoStepper
    if (videos.length >= 2) {
        return (
            <div className="space-y-6">
                <VideoStepper
                    videos={videos}
                    onAllWatched={onVideosWatched}
                />

                {/* Supporting text if available */}
                {lesson.text_content && (
                    <div className="prose prose-invert prose-sm max-w-none mt-8 pt-8 border-t border-white/10">
                        <h4 className="text-sm font-semibold text-white/60 mb-4">Additional Notes</h4>
                        <div
                            className="text-white/80 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: lesson.text_content }}
                        />
                    </div>
                )}
            </div>
        );
    }

    // Legacy: Single video (or content_type video/both with video_url)
    if ((lesson.content_type === "video" || lesson.content_type === "both") && lesson.video_url) {
        return (
            <div className="space-y-6">
                {/* Video Player */}
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-white/10">
                    {lesson.video_url.includes("youtube") || lesson.video_url.includes("youtu.be") ? (
                        // YouTube embed
                        <iframe
                            src={lesson.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                            className="absolute inset-0 h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    ) : lesson.video_url.includes("vimeo") ? (
                        // Vimeo embed
                        <iframe
                            src={lesson.video_url.replace("vimeo.com/", "player.vimeo.com/video/")}
                            className="absolute inset-0 h-full w-full"
                            allow="autoplay; fullscreen; picture-in-picture"
                            allowFullScreen
                        />
                    ) : (
                        // Direct video
                        <video
                            src={lesson.video_url}
                            controls
                            className="absolute inset-0 h-full w-full object-contain"
                        >
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>

                {/* Duration badge */}
                <div className="flex items-center gap-2 text-sm text-white/50">
                    <Clock size={14} />
                    <span>{lesson.duration_minutes} minute lesson</span>
                </div>

                {/* Text content if both */}
                {lesson.content_type === "both" && lesson.text_content && (
                    <div className="prose prose-invert prose-sm max-w-none mt-8">
                        <div
                            className="text-white/80 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: lesson.text_content }}
                        />
                    </div>
                )}
            </div>
        );
    }

    // Text-only content
    if (lesson.content_type === "text" && lesson.text_content) {
        return (
            <div className="space-y-6">
                {/* Text indicator */}
                <div className="flex items-center gap-2 text-sm text-white/50">
                    <FileText size={14} />
                    <span>{lesson.duration_minutes} minute read</span>
                </div>

                {/* Text content */}
                <div className="prose prose-invert prose-lg max-w-none">
                    <div
                        className="text-white/80 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: lesson.text_content }}
                    />
                </div>
            </div>
        );
    }

    // Loading state
    if (loadingVideos) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-white/40">
                <div className="animate-pulse">Loading content...</div>
            </div>
        );
    }

    // Fallback - no content
    return (
        <div className="flex flex-col items-center justify-center py-16 text-white/40">
            <Play size={48} className="mb-4 opacity-50" />
            <p>Content not available</p>
        </div>
    );
}
