"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BootcampWithLessons, LessonWithProgress, Lesson } from "@/lib/types/learning-flow";
import { useAuth } from "@/context/AuthProvider";
import Loading from "@/components/Loading";
import {
    LessonList,
    ProgressBar,
    LessonContent,
    CreateNowAction,
    LessonSuccessState,
} from "@/components/learning-flow";
import { ArrowLeft, ArrowRight, SkipForward, Menu, X, ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
    params: Promise<{ bootcamp: string; lesson: string }>;
};

export default function LessonPage({ params }: Props) {
    const { bootcamp: bootcampSlug, lesson: lessonSlugEncoded } = use(params);
    const lessonSlug = decodeURIComponent(lessonSlugEncoded);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, initialized } = useAuth();

    const [bootcamp, setBootcamp] = useState<BootcampWithLessons | null>(null);
    const [lesson, setLesson] = useState<LessonWithProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Track if user just completed the lesson
    const [completedState, setCompletedState] = useState<{
        completed: boolean;
        nextLesson: Lesson | null;
        generationId?: string;
    }>({ completed: false, nextLesson: null });

    // Track if content (video/text) is finished, separate from "lesson completed" API status
    // Initialize based on existing progress
    const [contentFinished, setContentFinished] = useState(
        lesson?.progress?.status === "completed"
    );

    // Update contentFinished when lesson loads or changes
    useEffect(() => {
        if (lesson?.progress?.status === "completed") {
            setContentFinished(true);
        }
    }, [lesson]);

    // Check if returning from studio with completion
    const fromStudio = searchParams?.get("completed") === "true";
    const generationId = searchParams?.get("generationId") || undefined;

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch(`/api/bootcamps/${bootcampSlug}`);
                if (!res.ok) {
                    if (res.status === 404) throw new Error("Bootcamp not found");
                    throw new Error("Failed to load bootcamp");
                }
                const data: BootcampWithLessons = await res.json();
                setBootcamp(data);

                // Find current lesson
                const currentLesson = data.lessons.find((l) => l.slug === lessonSlug);
                if (!currentLesson) {
                    throw new Error("Lesson not found");
                }
                setLesson(currentLesson);

                // Initialize content finished state
                if (currentLesson.progress?.status === "completed") {
                    setContentFinished(true);
                }

                // If returning from studio, mark as complete
                if (fromStudio && currentLesson) {
                    await handleComplete(currentLesson.id, generationId);
                }
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        if (initialized) {
            fetchData();
        }
    }, [initialized, bootcampSlug, lessonSlug, fromStudio]);

    const handleComplete = async (lessonId: string, genId?: string) => {
        try {
            const res = await fetch(`/api/lessons/${lessonId}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ generation_id: genId }),
            });
            const data = await res.json();
            if (res.ok) {
                setCompletedState({
                    completed: true,
                    nextLesson: data.next_lesson,
                    generationId: genId,
                });
                setContentFinished(true);
            }
        } catch (e) {
            console.error("Failed to mark lesson complete:", e);
        }
    };

    const handleSkip = async () => {
        if (!lesson) return;
        try {
            const res = await fetch(`/api/lessons/${lesson.id}/skip`, {
                method: "POST",
            });
            const data = await res.json();
            if (res.ok && data.next_lesson) {
                router.push(`/learn/${bootcampSlug}/${data.next_lesson.slug}`);
            } else {
                router.push(`/learn/${bootcampSlug}`);
            }
        } catch (e) {
            console.error("Failed to skip lesson:", e);
        }
    };

    if (!initialized || loading) {
        return <Loading />;
    }

    if (error || !bootcamp || !lesson) {
        return (
            <main className="mx-auto w-full max-w-4xl px-4 py-8 text-white">
                <Link href={`/learn/${bootcampSlug}`} className="flex items-center gap-2 text-white/60 hover:text-white mb-8">
                    <ArrowLeft size={20} />
                    Back to Bootcamp
                </Link>
                <div className="text-center py-20">
                    <p className="text-xl text-white/60">{error || "Lesson not found"}</p>
                </div>
            </main>
        );
    }

    const currentIndex = bootcamp.lessons.findIndex((l) => l.id === lesson.id);
    const prevLesson = currentIndex > 0 ? bootcamp.lessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < bootcamp.lessons.length - 1 ? bootcamp.lessons[currentIndex + 1] : null;
    const isAlreadyCompleted = lesson.progress?.status === "completed";

    // Show success state if just completed
    if (completedState.completed) {
        return (
            <main className="mx-auto w-full max-w-3xl px-4 py-12 text-white">
                <LessonSuccessState
                    lesson={lesson}
                    bootcampSlug={bootcampSlug}
                    nextLesson={completedState.nextLesson}
                    generationId={completedState.generationId}
                />
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Mobile Header */}
            <div className="lg:hidden sticky top-0 z-40 bg-black/90 backdrop-blur-lg border-b border-white/10">
                <div className="flex items-center justify-between px-4 py-3">
                    <Link href={`/learn/${bootcampSlug}`} className="flex items-center gap-2 text-white/60">
                        <ArrowLeft size={20} />
                    </Link>
                    <span className="font-medium text-sm truncate max-w-[50%]">{lesson.title}</span>
                    <button onClick={() => setSidebarOpen(true)} className="text-white/60">
                        <Menu size={24} />
                    </button>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setSidebarOpen(false)} />
                    <div className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-white/10 overflow-y-auto">
                        <div className="p-4 border-b border-white/10 flex items-center justify-between">
                            <h3 className="font-bold">Lessons</h3>
                            <button onClick={() => setSidebarOpen(false)}>
                                <X size={20} className="text-white/60" />
                            </button>
                        </div>
                        <div className="p-4">
                            <LessonList
                                lessons={bootcamp.lessons}
                                bootcampSlug={bootcampSlug}
                                bootcampProgress={bootcamp.user_progress}
                                currentLessonId={lesson.id}
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex">
                {/* Desktop Sidebar */}
                <aside className="hidden lg:block w-80 shrink-0 border-r border-white/10 h-screen sticky top-0 overflow-y-auto bg-zinc-950">
                    <div className="p-4 border-b border-white/10">
                        <Link href={`/learn/${bootcampSlug}`} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-3">
                            <ArrowLeft size={16} />
                            {bootcamp.title}
                        </Link>
                        <ProgressBar
                            bootcamp={bootcamp}
                            progress={bootcamp.user_progress}
                            lessonsTotal={bootcamp.lessons.length}
                        />
                    </div>
                    <div className="p-4">
                        <LessonList
                            lessons={bootcamp.lessons}
                            bootcampSlug={bootcampSlug}
                            bootcampProgress={bootcamp.user_progress}
                            currentLessonId={lesson.id}
                        />
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 min-w-0">
                    <div className="max-w-3xl mx-auto px-4 py-8 lg:py-12">
                        {/* Lesson Header */}
                        <div className="mb-8">
                            <div className="text-xs font-semibold uppercase tracking-wider text-[#B7FF00] mb-2">
                                Lesson {currentIndex + 1} of {bootcamp.lessons.length}
                            </div>
                            <h1 className="text-2xl lg:text-3xl font-bold mb-2">{lesson.title}</h1>
                            {lesson.learning_objective && (
                                <p className="text-white/60">
                                    <span className="text-white/40">Goal:</span> {lesson.learning_objective}
                                </p>
                            )}
                        </div>

                        {/* Lesson Content (Video/Text) */}
                        <div className="mb-10">
                            <LessonContent
                                lesson={lesson}
                                bootcampSlug={bootcampSlug}
                                nextLessonSlug={nextLesson?.slug}
                                onVideoComplete={() => setContentFinished(true)}
                            />
                        </div>



                        {/* Already completed message */}
                        {isAlreadyCompleted && (
                            <div className="mb-10 rounded-xl border border-[#B7FF00]/20 bg-[#B7FF00]/5 p-4 text-center">
                                <p className="text-white/70">
                                    ✓ You've completed this lesson.{" "}
                                    <button
                                        onClick={() => handleComplete(lesson.id)}
                                        className="text-[#B7FF00] hover:underline"
                                    >
                                        Create again
                                    </button>
                                    {" "}or continue to the next lesson.
                                </p>
                            </div>
                        )}

                        {/* Navigation */}
                        <div className="flex items-center justify-between border-t border-white/10 pt-6 mt-6">
                            {prevLesson ? (
                                <Link
                                    href={`/learn/${bootcampSlug}/${prevLesson.slug}`}
                                    className="flex items-center gap-2 text-white/60 hover:text-white transition"
                                >
                                    <ChevronLeft size={18} />
                                    <span className="text-sm">Previous</span>
                                </Link>
                            ) : (
                                <div />
                            )}

                            <button
                                onClick={handleSkip}
                                className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition"
                            >
                                <SkipForward size={16} />
                                Skip for now
                            </button>

                            {nextLesson ? (
                                <Link
                                    href={`/learn/${bootcampSlug}/${nextLesson.slug}`}
                                    className="flex items-center gap-2 text-white/60 hover:text-white transition"
                                >
                                    <span className="text-sm">Next</span>
                                    <ChevronRight size={18} />
                                </Link>
                            ) : (
                                <Link
                                    href={`/learn/${bootcampSlug}`}
                                    className="flex items-center gap-2 text-[#B7FF00] hover:text-[#a3e600] transition"
                                >
                                    <span className="text-sm font-semibold">Finish</span>
                                    <ArrowRight size={18} />
                                </Link>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
