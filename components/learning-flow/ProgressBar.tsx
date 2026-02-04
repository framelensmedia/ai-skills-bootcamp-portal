"use client";

import { Bootcamp, BootcampProgress } from "@/lib/types/learning-flow";

type ProgressBarProps = {
    bootcamp: Bootcamp;
    progress?: BootcampProgress;
    lessonsTotal: number;
};

export default function ProgressBar({
    bootcamp,
    progress,
    lessonsTotal,
}: ProgressBarProps) {
    const completed = progress?.lessons_completed || 0;
    const skipped = progress?.lessons_skipped || 0;
    const total = lessonsTotal || bootcamp.lesson_count || 1;

    const completedPercent = (completed / total) * 100;
    const skippedPercent = (skipped / total) * 100;
    const totalProgress = completedPercent + skippedPercent;

    const isComplete = totalProgress >= 100;

    return (
        <div className="space-y-2">
            {/* Progress bar */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                {/* Completed portion */}
                <div
                    className="absolute left-0 top-0 h-full bg-[#B7FF00] transition-all duration-500"
                    style={{ width: `${completedPercent}%` }}
                />
                {/* Skipped portion (different color) */}
                <div
                    className="absolute top-0 h-full bg-white/30 transition-all duration-500"
                    style={{
                        left: `${completedPercent}%`,
                        width: `${skippedPercent}%`
                    }}
                />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                    <span className="text-white/60">
                        <span className="font-semibold text-white">{completed}</span> of {total} lessons
                    </span>
                    {skipped > 0 && (
                        <span className="text-white/40">
                            ({skipped} skipped)
                        </span>
                    )}
                </div>

                <div className="font-semibold">
                    {isComplete ? (
                        <span className="text-[#B7FF00]">Complete! ✓</span>
                    ) : (
                        <span className="text-white/60">{Math.round(totalProgress)}%</span>
                    )}
                </div>
            </div>
        </div>
    );
}
