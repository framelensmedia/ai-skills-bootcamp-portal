"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BootcampWithLessons, Lesson } from "@/lib/types/learning-flow";
import { useAuth } from "@/context/AuthProvider";
import Loading from "@/components/Loading";
import { LessonList, ProgressBar } from "@/components/learning-flow";
import { ArrowLeft, Clock, BookOpen, Play, ArrowRight } from "lucide-react";

type Props = {
    params: Promise<{ bootcamp: string }>;
};

export default function BootcampPage({ params }: Props) {
    const { bootcamp: bootcampSlug } = use(params);
    const router = useRouter();
    const { user, initialized } = useAuth();

    const [bootcamp, setBootcamp] = useState<BootcampWithLessons | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchBootcamp() {
            try {
                const res = await fetch(`/api/bootcamps/${bootcampSlug}`);
                if (!res.ok) {
                    if (res.status === 404) throw new Error("Bootcamp not found");
                    throw new Error("Failed to load bootcamp");
                }
                const data = await res.json();
                setBootcamp(data);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        if (initialized) {
            fetchBootcamp();
        }
    }, [initialized, bootcampSlug]);

    if (!initialized || loading) {
        return <Loading />;
    }

    if (error || !bootcamp) {
        return (
            <main className="mx-auto w-full max-w-4xl px-4 py-8 text-white">
                <Link href="/learn" className="flex items-center gap-2 text-white/60 hover:text-white mb-8">
                    <ArrowLeft size={20} />
                    Back to Bootcamps
                </Link>
                <div className="text-center py-20">
                    <p className="text-xl text-white/60">{error || "Bootcamp not found"}</p>
                </div>
            </main>
        );
    }

    // Find current/next lesson
    const currentLesson = bootcamp.lessons.find(
        (l) => !l.progress || (l.progress.status !== "completed" && l.progress.status !== "skipped")
    );
    const completedCount = bootcamp.lessons.filter(l => l.progress?.status === "completed").length;
    const isComplete = completedCount === bootcamp.lessons.length;

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-8 text-white font-sans">
            {/* Back link */}
            <Link
                href="/learn"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-6 transition"
            >
                <ArrowLeft size={18} />
                <span>All Bootcamps</span>
            </Link>

            {/* Header */}
            <div className="flex flex-col lg:flex-row gap-8 mb-8">
                {/* Thumbnail */}
                <div className="lg:w-80 shrink-0">
                    <div className="relative aspect-video lg:aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black border border-white/10">
                        {bootcamp.thumbnail_url ? (
                            <Image
                                src={bootcamp.thumbnail_url}
                                alt={bootcamp.title}
                                fill
                                className="object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#B7FF00]/20 to-transparent">
                                <BookOpen size={64} className="text-[#B7FF00]/50" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1">
                    <h1 className="text-3xl font-bold tracking-tight mb-3">{bootcamp.title}</h1>

                    {bootcamp.description && (
                        <p className="text-white/70 text-lg mb-6">{bootcamp.description}</p>
                    )}

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-white/50 mb-6">
                        <span className="flex items-center gap-2">
                            <BookOpen size={16} />
                            {bootcamp.lesson_count} lessons
                        </span>
                        <span className="flex items-center gap-2">
                            <Clock size={16} />
                            {bootcamp.total_duration_minutes} minutes total
                        </span>
                    </div>

                    {/* Progress */}
                    {user && (
                        <div className="mb-6">
                            <ProgressBar
                                bootcamp={bootcamp}
                                progress={bootcamp.user_progress}
                                lessonsTotal={bootcamp.lessons.length}
                            />
                        </div>
                    )}

                    {/* CTA */}
                    {currentLesson && !isComplete && (
                        <Link
                            href={`/learn/${bootcampSlug}/${currentLesson.slug}`}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#B7FF00] px-6 py-3 font-bold text-black hover:bg-[#a3e600] transition"
                        >
                            <Play size={18} fill="currentColor" />
                            {bootcamp.user_progress?.lessons_completed ? "Continue Learning" : "Start Bootcamp"}
                        </Link>
                    )}

                    {isComplete && (
                        <div className="inline-flex items-center gap-2 rounded-xl bg-[#B7FF00]/20 border border-[#B7FF00]/30 px-6 py-3 font-bold text-[#B7FF00]">
                            ✓ Bootcamp Complete!
                        </div>
                    )}
                </div>
            </div>

            {/* Lesson List */}
            <div className="mt-10">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <span>Lessons</span>
                    <span className="text-sm font-normal text-white/40">({bootcamp.lessons.length})</span>
                </h2>

                <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-4">
                    <LessonList
                        lessons={bootcamp.lessons}
                        bootcampSlug={bootcampSlug}
                        bootcampProgress={bootcamp.user_progress}
                        currentLessonId={currentLesson?.id}
                    />
                </div>
            </div>
        </main>
    );
}
