"use client";

import Link from "next/link";
import { Clock, Check, Play, Lock, Sparkles, ChevronRight } from "lucide-react";

type MissionStatus = "not_started" | "in_progress" | "completed" | "skipped" | "locked";

type Props = {
    index: number;
    title: string;
    objective?: string | null;
    durationMinutes: number;
    status: MissionStatus;
    bootcampSlug: string;
    missionSlug: string;
    isCurrent?: boolean;
    isPremium?: boolean;
    hasAccess?: boolean;
};

export default function MissionCard({
    index,
    title,
    objective,
    durationMinutes,
    status,
    bootcampSlug,
    missionSlug,
    isCurrent = false,
    isPremium = false,
    hasAccess = true,
}: Props) {
    const isLocked = !hasAccess && isPremium;
    const effectiveStatus = isLocked ? "locked" : status;

    const statusConfig = {
        not_started: {
            bg: "bg-zinc-900/50",
            border: "border-white/10 hover:border-white/20",
            icon: <span className="text-white/40 font-bold">{index + 1}</span>,
            pill: null,
        },
        in_progress: {
            bg: "bg-gradient-to-br from-[#B7FF00]/5 to-transparent",
            border: "border-[#B7FF00]/30 hover:border-[#B7FF00]/50",
            icon: <Play size={14} className="text-[#B7FF00]" />,
            pill: (
                <span className="px-2 py-0.5 rounded-full bg-[#B7FF00]/20 text-[#B7FF00] text-[10px] font-semibold">
                    IN PROGRESS
                </span>
            ),
        },
        completed: {
            bg: "bg-green-500/5",
            border: "border-green-500/20 hover:border-green-500/40",
            icon: <Check size={14} className="text-green-400" />,
            pill: (
                <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-semibold">
                    COMPLETE
                </span>
            ),
        },
        skipped: {
            bg: "bg-zinc-900/50",
            border: "border-white/10",
            icon: <span className="text-white/30 font-bold line-through">{index + 1}</span>,
            pill: (
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/40 text-[10px] font-semibold">
                    SKIPPED
                </span>
            ),
        },
        locked: {
            bg: "bg-zinc-900/30",
            border: "border-white/5",
            icon: <Lock size={14} className="text-white/30" />,
            pill: (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-semibold">
                    PREMIUM
                </span>
            ),
        },
    };

    const config = statusConfig[effectiveStatus];

    const content = (
        <div
            className={`
        group relative rounded-xl border ${config.border} ${config.bg} p-4 transition
        ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        ${isCurrent ? "ring-1 ring-[#B7FF00]/30" : ""}
      `}
        >
            {/* Current indicator */}
            {isCurrent && (
                <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-[#B7FF00]" />
            )}

            <div className="flex items-center gap-4">
                {/* Status icon */}
                <div className={`
          flex items-center justify-center w-8 h-8 rounded-lg shrink-0
          ${effectiveStatus === "completed" ? "bg-green-500/20" :
                        effectiveStatus === "in_progress" ? "bg-[#B7FF00]/20" :
                            "bg-white/5"}
        `}>
                    {config.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-white truncate">
                            {title}
                        </h3>
                        {config.pill}
                    </div>

                    {objective && (
                        <p className="text-xs text-white/40 truncate mb-1">
                            {objective}
                        </p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-white/30">
                        <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {durationMinutes}m
                        </span>
                        <span className="flex items-center gap-1">
                            <Sparkles size={10} />
                            Create
                        </span>
                    </div>
                </div>

                {/* Arrow */}
                {!isLocked && (
                    <ChevronRight
                        size={16}
                        className="text-white/20 group-hover:text-white/50 group-hover:translate-x-1 transition-all"
                    />
                )}
            </div>

            {/* Hover effect */}
            {!isLocked && effectiveStatus === "not_started" && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#B7FF00]/0 to-[#B7FF00]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}
        </div>
    );

    if (isLocked) {
        return content;
    }

    return (
        <Link href={`/learn/${bootcampSlug}/${missionSlug}`}>
            {content}
        </Link>
    );
}
