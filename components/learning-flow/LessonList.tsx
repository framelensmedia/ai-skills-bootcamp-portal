"use client";

import { LessonWithProgress, BootcampProgress } from "@/lib/types/learning-flow";
import { Check, Circle, Play, SkipForward, Clock, Lock } from "lucide-react";
import Link from "next/link";

type LessonListProps = {
    lessons: LessonWithProgress[];
    bootcampSlug: string;
    bootcampProgress?: BootcampProgress;
    currentLessonId?: string;
};

export default function LessonList({
    lessons,
    bootcampSlug,
    bootcampProgress,
    currentLessonId,
}: LessonListProps) {
    const getStatusIcon = (lesson: LessonWithProgress, index: number) => {
        const status = lesson.progress?.status;

        if (status === "completed") {
            return (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B7FF00] text-black">
                    <Check size={16} strokeWidth={3} />
                </div>
            );
        }

        if (status === "skipped") {
            return (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/50">
                    <SkipForward size={14} />
                </div>
            );
        }

        if (status === "in_progress" || lesson.id === currentLessonId) {
            return (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#B7FF00]/20 text-[#B7FF00] ring-2 ring-[#B7FF00]">
                    <Play size={14} fill="currentColor" />
                </div>
            );
        }

        // Not started
        return (
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/40">
                <span className="text-sm font-semibold">{index + 1}</span>
            </div>
        );
    };

    return (
        <div className="space-y-1">
            {lessons.map((lesson, index) => {
                const isActive = lesson.id === currentLessonId;
                const isCompleted = lesson.progress?.status === "completed";
                const isSkipped = lesson.progress?.status === "skipped";

                return (
                    <Link
                        key={lesson.id}
                        href={`/learn/${bootcampSlug}/${lesson.slug}`}
                        className={`
              group flex items-center gap-4 rounded-xl p-3 transition-all
              ${isActive
                                ? "bg-[#B7FF00]/10 border border-[#B7FF00]/30"
                                : "hover:bg-white/5 border border-transparent"
                            }
            `}
                    >
                        {getStatusIcon(lesson, index)}

                        <div className="flex-1 min-w-0">
                            <div className={`
                text-sm font-medium truncate
                ${isActive ? "text-white" : isCompleted ? "text-white/70" : "text-white/90"}
              `}>
                                {lesson.title}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-white/40 flex items-center gap-1">
                                    <Clock size={10} />
                                    {lesson.duration_minutes} min
                                </span>

                                {isCompleted && (
                                    <span className="text-xs text-[#B7FF00]/70">Completed</span>
                                )}
                                {isSkipped && (
                                    <span className="text-xs text-white/40">Skipped</span>
                                )}
                            </div>
                        </div>

                        {isActive && (
                            <div className="shrink-0 text-xs font-bold uppercase tracking-wider text-[#B7FF00]">
                                Current
                            </div>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
