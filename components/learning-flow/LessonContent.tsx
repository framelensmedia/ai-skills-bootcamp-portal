"use client";

import { Lesson, LessonWithProgress } from "@/lib/types/learning-flow";
import { Play, FileText, Clock, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import VideoStepper from "./VideoStepper"; // Keep for legacy if needed, or remove if fully migrated
import ContentStepper from "./ContentStepper";
import { LessonContentItem } from "@/components/cms/LessonContentManager";
import LessonCompleteModal from "./LessonCompleteModal";
import { useRouter } from "next/navigation";

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
    lesson: LessonWithProgress & { videos?: Video[] };
    bootcampSlug: string;
    nextLessonSlug?: string;
    onVideoComplete?: () => void;
};

export default function LessonContent({ lesson, bootcampSlug, nextLessonSlug, onVideoComplete }: LessonContentProps) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const router = useRouter();

    // State
    const [contentItems, setContentItems] = useState<LessonContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [legacyVideos, setLegacyVideos] = useState<Video[]>(lesson.videos || []);
    const [showCompleteModal, setShowCompleteModal] = useState(false);

    // Fetch content on mount
    useEffect(() => {
        loadContent();
    }, [lesson.id]);

    async function loadContent() {
        setLoading(true);
        try {
            // 1. Try to fetch new lesson_contents
            const { data: contents } = await supabase
                .from("lesson_contents")
                .select("*")
                .eq("lesson_id", lesson.id)
                .eq("is_published", true)
                .order("order_index", { ascending: true });

            console.log(`[LessonContent] Loaded contents for ${lesson.id}:`, contents?.length);

            if (contents && contents.length > 0) {
                setContentItems(contents as LessonContentItem[]);
            } else {
                console.log("[LessonContent] Falling back to legacy videos");
                // 2. Fallback to legacy lesson_videos if no new content
                if (!lesson.videos) {
                    const { data: videos } = await supabase
                        .from("lesson_videos")
                        .select("*")
                        .eq("lesson_id", lesson.id)
                        .eq("is_published", true)
                        .order("order_index", { ascending: true });

                    if (videos && videos.length > 0) {
                        setLegacyVideos(videos);
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load lesson content:", e);
        } finally {
            setLoading(false);
        }
    }

    // Track initial completion status to prevent auto-opening modal on revisit
    const wasCompletedRef = useRef(lesson.progress?.status === "completed");

    function handleCompletion() {

        // precise check: only show modal if it WAS NOT completed when we loaded the page
        // OR if the user explicitly triggers it (e.g. re-watching doesn't trigger, but completing a new item does)
        if (!wasCompletedRef.current) {
            // Trigger generic completion logic (XP, progress update) -> handled by stepper/video component
            // Notify parent ONLY if this is a NEW completion
            if (onVideoComplete) onVideoComplete();
            setShowCompleteModal(true);
        }
    }

    // Prepare progress set
    const completedIds = useMemo(() => {
        const ids = new Set<string>();
        if (lesson.content_progress) {
            lesson.content_progress.forEach(cp => {
                if (cp.is_completed) ids.add(cp.content_id);
            });
        }
        return ids;
    }, [lesson.content_progress]);

    // RENDER: Loading
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-white/40">
                <Loader2 className="animate-spin mb-2" />
                <div>Loading content...</div>
            </div>
        );
    }

    // RENDER: Mixed Content (New System)
    if (contentItems.length > 0) {
        return (
            <>
                <div className="space-y-6">
                    <ContentStepper
                        items={contentItems}
                        lessonId={lesson.id}
                        onAllCompleted={handleCompletion}
                        initialCompletedIds={completedIds}
                    />


                </div>

                <LessonCompleteModal
                    isOpen={showCompleteModal}
                    onClose={() => setShowCompleteModal(false)}
                    lessonTitle={lesson.title}
                    bootcampSlug={bootcampSlug}
                    nextLessonSlug={nextLessonSlug}
                    onCreateClick={() => router.push("/studio")}
                />
            </>
        );
    }

    // RENDER: Legacy Multiple Videos
    if (legacyVideos.length >= 2) {
        return (
            <div className="space-y-6">
                <VideoStepper
                    videos={legacyVideos}
                    lessonId={lesson.id}
                    onAllWatched={handleCompletion}
                />

                {/* Modal for legacy too */}
                <LessonCompleteModal
                    isOpen={showCompleteModal}
                    onClose={() => setShowCompleteModal(false)}
                    lessonTitle={lesson.title}
                    bootcampSlug={bootcampSlug}
                    nextLessonSlug={nextLessonSlug}
                    onCreateClick={() => router.push("/studio")}
                />


            </div>
        );
    }

    // RENDER: Legacy Single Video / Text
    // ... (Keep existing simple render logic for single video/text)
    if ((lesson.content_type === "video" || lesson.content_type === "both") && lesson.video_url) {
        return (
            <div className="space-y-6">
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-white/10">
                    {/* Simplified embed logic for brevity, assuming helper or raw */}
                    <iframe
                        src={lesson.video_url.includes("youtu")
                            ? lesson.video_url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")
                            : lesson.video_url}
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
                <button
                    onClick={handleCompletion}
                    className="w-full py-4 rounded-xl bg-[#B7FF00]/10 text-[#B7FF00] font-bold hover:bg-[#B7FF00]/20 transition"
                >
                    Mark Complete
                </button>

                <LessonCompleteModal
                    isOpen={showCompleteModal}
                    onClose={() => setShowCompleteModal(false)}
                    lessonTitle={lesson.title}
                    bootcampSlug={bootcampSlug}
                    nextLessonSlug={nextLessonSlug}
                    onCreateClick={() => router.push("/studio")}
                />
            </div>
        );
    }

    // Fallback Text Only
    return (
        <div className="space-y-6">
            <div className="prose prose-invert prose-lg max-w-none">
                <div dangerouslySetInnerHTML={{ __html: lesson.text_content || "" }} />
            </div>
            <button
                onClick={handleCompletion}
                className="mt-8 px-6 py-3 rounded-lg bg-[#B7FF00] text-black font-bold hover:opacity-90 transition"
            >
                Complete Lesson
            </button>
            <LessonCompleteModal
                isOpen={showCompleteModal}
                onClose={() => setShowCompleteModal(false)}
                lessonTitle={lesson.title}
                bootcampSlug={bootcampSlug}
                nextLessonSlug={nextLessonSlug}
                onCreateClick={() => router.push("/studio")}
            />
        </div>
    );
}
