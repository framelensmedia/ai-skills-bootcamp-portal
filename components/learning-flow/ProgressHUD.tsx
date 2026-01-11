"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Flame, Sparkles, Trophy, Target } from "lucide-react";

type Props = {
    bootcampTitle: string;
    bootcampSlug: string;
    currentMissionTitle: string;
    currentMissionNumber: number;
    totalMissions: number;
    completedCount: number;
    streak?: number; // Optional streak count
};

export default function ProgressHUD({
    bootcampTitle,
    bootcampSlug,
    currentMissionTitle,
    currentMissionNumber,
    totalMissions,
    completedCount,
    streak = 0,
}: Props) {
    const [showStreak, setShowStreak] = useState(false);
    const progressPercent = totalMissions > 0 ? Math.round((completedCount / totalMissions) * 100) : 0;

    useEffect(() => {
        // Animate streak in after mount
        if (streak > 0) {
            const timer = setTimeout(() => setShowStreak(true), 500);
            return () => clearTimeout(timer);
        }
    }, [streak]);

    return (
        <div className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-lg border-b border-white/10">
            <div className="max-w-4xl mx-auto px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                    {/* Left: Breadcrumb */}
                    <div className="flex items-center gap-2 text-xs min-w-0">
                        <Link
                            href="/learn"
                            className="text-white/40 hover:text-white transition shrink-0"
                        >
                            Learn
                        </Link>
                        <ChevronRight size={12} className="text-white/20 shrink-0" />
                        <Link
                            href={`/learn/${bootcampSlug}`}
                            className="text-white/60 hover:text-white transition truncate"
                        >
                            {bootcampTitle}
                        </Link>
                        <ChevronRight size={12} className="text-white/20 shrink-0" />
                        <span className="text-[#B7FF00] font-medium truncate">
                            Mission {currentMissionNumber}
                        </span>
                    </div>

                    {/* Right: Progress & Streak */}
                    <div className="flex items-center gap-4">
                        {/* Streak (if > 0) */}
                        {streak > 0 && (
                            <div
                                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-full 
                  bg-gradient-to-r from-orange-500/20 to-amber-500/20 
                  border border-orange-500/30
                  transition-all duration-500
                  ${showStreak ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}
                `}
                            >
                                <Flame size={14} className="text-orange-400" />
                                <span className="text-xs font-bold text-orange-300">{streak}</span>
                            </div>
                        )}

                        {/* Progress Ring */}
                        <div className="flex items-center gap-2">
                            <div className="relative w-8 h-8">
                                {/* Background ring */}
                                <svg className="w-8 h-8 transform -rotate-90">
                                    <circle
                                        cx="16"
                                        cy="16"
                                        r="12"
                                        stroke="rgba(255,255,255,0.1)"
                                        strokeWidth="3"
                                        fill="none"
                                    />
                                    {/* Progress ring */}
                                    <circle
                                        cx="16"
                                        cy="16"
                                        r="12"
                                        stroke="#B7FF00"
                                        strokeWidth="3"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeDasharray={`${progressPercent * 0.75} 100`}
                                        className="transition-all duration-500"
                                    />
                                </svg>
                                {/* Center icon */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {progressPercent === 100 ? (
                                        <Trophy size={12} className="text-[#B7FF00]" />
                                    ) : (
                                        <Target size={10} className="text-white/40" />
                                    )}
                                </div>
                            </div>

                            <div className="text-xs">
                                <div className="font-medium text-white">
                                    {completedCount}/{totalMissions}
                                </div>
                                <div className="text-white/40">missions</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress bar underneath */}
                <div className="mt-2 h-0.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[#B7FF00] to-[#7ACC00] rounded-full transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
