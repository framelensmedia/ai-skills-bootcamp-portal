"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import Link from "next/link";
import { Play, ArrowRight, X, Clock, Sparkles } from "lucide-react";

type IncompleteMission = {
    lesson_id: string;
    bootcamp_id: string;
    lesson_title: string;
    bootcamp_title: string;
    bootcamp_slug: string;
    lesson_slug: string;
    started_at: string;
};

type Props = {
    userId?: string;
};

export default function ResumeNudge({ userId }: Props) {
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);
    const [mission, setMission] = useState<IncompleteMission | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            checkIncompleteMission();
        } else {
            setLoading(false);
        }
    }, [userId]);

    async function checkIncompleteMission() {
        try {
            // Get most recently started incomplete mission
            const { data: progress } = await supabase
                .from("lesson_progress")
                .select(`
          lesson_id,
          bootcamp_id,
          started_at,
          lessons (
            title,
            slug,
            bootcamps (
              title,
              slug
            )
          )
        `)
                .eq("user_id", userId)
                .eq("status", "in_progress")
                .order("started_at", { ascending: false })
                .limit(1)
                .single();

            if (progress && (progress as any).lessons) {
                const lesson = (progress as any).lessons;
                const bootcamp = lesson.bootcamps;

                setMission({
                    lesson_id: progress.lesson_id,
                    bootcamp_id: progress.bootcamp_id,
                    lesson_title: lesson.title,
                    bootcamp_title: bootcamp.title,
                    bootcamp_slug: bootcamp.slug,
                    lesson_slug: lesson.slug,
                    started_at: progress.started_at,
                });
            }
        } catch (e) {
            // No incomplete missions
        } finally {
            setLoading(false);
        }
    }

    if (loading || !mission || dismissed) return null;

    const timeSinceStart = mission.started_at
        ? Math.floor((Date.now() - new Date(mission.started_at).getTime()) / 1000 / 60)
        : 0;

    const timeLabel = timeSinceStart < 60
        ? `${timeSinceStart}m ago`
        : timeSinceStart < 1440
            ? `${Math.floor(timeSinceStart / 60)}h ago`
            : `${Math.floor(timeSinceStart / 1440)}d ago`;

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-slide-up">
            <div className="rounded-2xl border border-[#B7FF00]/30 bg-zinc-900/95 backdrop-blur-lg p-4 shadow-2xl">
                <button
                    onClick={() => setDismissed(true)}
                    className="absolute top-2 right-2 p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white"
                >
                    <X size={14} />
                </button>

                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#B7FF00] to-[#7ACC00] flex items-center justify-center">
                        <Play size={18} className="text-black" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                        <div className="text-xs text-[#B7FF00] font-semibold mb-1 flex items-center gap-2">
                            <Sparkles size={10} />
                            Continue Mission
                        </div>
                        <div className="font-medium text-sm text-white truncate mb-0.5">
                            {mission.lesson_title}
                        </div>
                        <div className="text-xs text-white/40 flex items-center gap-2">
                            <span>{mission.bootcamp_title}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                                <Clock size={10} />
                                Started {timeLabel}
                            </span>
                        </div>
                    </div>
                </div>

                <Link
                    href={`/learn/${mission.bootcamp_slug}/${mission.lesson_slug}`}
                    className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl bg-[#B7FF00] py-2 text-sm font-semibold text-black hover:bg-[#a3e600] transition"
                >
                    Resume
                    <ArrowRight size={14} />
                </Link>
            </div>

            <style jsx>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
        </div>
    );
}
