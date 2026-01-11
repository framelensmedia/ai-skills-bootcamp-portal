"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Bootcamp, BootcampProgress } from "@/lib/types/learning-flow";
import { useAuth } from "@/context/AuthProvider";
import Loading from "@/components/Loading";
import { Clock, BookOpen, ArrowRight, Play, Lock, CheckCircle } from "lucide-react";

export default function LearnPage() {
    const router = useRouter();
    const { user, initialized } = useAuth();

    const [bootcamps, setBootcamps] = useState<Bootcamp[]>([]);
    const [userProgress, setUserProgress] = useState<Record<string, BootcampProgress>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchBootcamps() {
            try {
                const res = await fetch("/api/bootcamps");
                if (!res.ok) throw new Error("Failed to load bootcamps");
                const data = await res.json();
                setBootcamps(data.bootcamps || []);
                setUserProgress(data.user_progress || {});
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }

        if (initialized) {
            fetchBootcamps();
        }
    }, [initialized]);

    if (!initialized || loading) {
        return <Loading />;
    }

    const getProgressPercent = (bootcamp: Bootcamp) => {
        const progress = userProgress[bootcamp.id];
        if (!progress || bootcamp.lesson_count === 0) return 0;
        return Math.round(
            ((progress.lessons_completed + progress.lessons_skipped) / bootcamp.lesson_count) * 100
        );
    };

    const getProgressStatus = (bootcamp: Bootcamp) => {
        const progress = userProgress[bootcamp.id];
        if (!progress) return "not_started";
        if (progress.completed_at) return "completed";
        if (progress.lessons_completed > 0 || progress.lessons_skipped > 0) return "in_progress";
        return "not_started";
    };

    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-8 text-white font-sans">
            {/* Header */}
            <div className="mb-10">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                    Learn <span className="text-[#B7FF00]">AI Skills</span>
                </h1>
                <p className="text-white/60 text-lg">
                    Short bootcamps designed to get you creating fast.
                </p>
            </div>

            {error && (
                <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
                    {error}
                </div>
            )}

            {/* Bootcamp Grid */}
            {bootcamps.length === 0 ? (
                <div className="text-center py-20 text-white/40">
                    <BookOpen size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No bootcamps available yet.</p>
                    <p className="text-sm mt-2">Check back soon!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bootcamps.map((bootcamp) => {
                        const progressPercent = getProgressPercent(bootcamp);
                        const status = getProgressStatus(bootcamp);
                        const isPremium = bootcamp.access_level === "premium";
                        const isStarted = status !== "not_started";
                        const isCompleted = status === "completed";

                        return (
                            <Link
                                key={bootcamp.id}
                                href={`/learn/${bootcamp.slug}`}
                                className={`
                                    group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300
                                    ${isCompleted
                                        ? "border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent hover:border-green-500/40"
                                        : isStarted
                                            ? "border-[#B7FF00]/20 bg-gradient-to-br from-[#B7FF00]/5 to-transparent hover:border-[#B7FF00]/40"
                                            : "border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900"
                                    }
                                `}
                            >
                                {/* Thumbnail */}
                                <div className="relative aspect-video w-full overflow-hidden bg-black">
                                    {bootcamp.thumbnail_url ? (
                                        <Image
                                            src={bootcamp.thumbnail_url}
                                            alt={bootcamp.title}
                                            fill
                                            className="object-cover transition duration-500 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                                                <BookOpen size={24} className="text-white/20" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                                    {/* Status badge */}
                                    <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
                                        {isCompleted && (
                                            <div className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/20 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-green-400 shadow-lg">
                                                <CheckCircle size={12} strokeWidth={2.5} />
                                                Complete
                                            </div>
                                        )}
                                        {!isCompleted && isStarted && (
                                            <div className="flex items-center gap-1.5 rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/20 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-[#B7FF00] shadow-lg">
                                                <Play size={12} fill="currentColor" />
                                                {progressPercent}%
                                            </div>
                                        )}
                                        {isPremium && status === "not_started" && (
                                            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-amber-400 shadow-lg">
                                                <Lock size={12} />
                                                Premium
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex flex-1 flex-col p-5">
                                    <h3 className="text-lg font-bold leading-tight text-white group-hover:text-[#B7FF00] transition-colors mb-2 line-clamp-2">
                                        {bootcamp.title}
                                    </h3>

                                    {bootcamp.description && (
                                        <p className="text-sm leading-relaxed text-white/50 line-clamp-2 mb-4">
                                            {bootcamp.description}
                                        </p>
                                    )}

                                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">

                                        {/* Left: Meta */}
                                        <div className="flex items-center gap-4 text-xs font-medium text-white/40">
                                            <span className="flex items-center gap-1.5">
                                                <BookOpen size={12} />
                                                {bootcamp.lesson_count} lessons
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <Clock size={12} />
                                                {bootcamp.total_duration_minutes} min
                                            </span>
                                        </div>

                                        {/* Right: Arrow Button */}
                                        <div className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 ${isCompleted
                                                ? "border-green-500/30 bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-black group-hover:border-green-500"
                                                : isStarted
                                                    ? "border-[#B7FF00]/30 bg-[#B7FF00]/10 text-[#B7FF00] group-hover:bg-[#B7FF00] group-hover:text-black group-hover:border-[#B7FF00]"
                                                    : "border-white/10 bg-white/5 text-white/40 group-hover:border-[#B7FF00] group-hover:bg-[#B7FF00] group-hover:text-black"
                                            }`}>
                                            <ArrowRight size={14} className="-ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>

                                    {/* Progress bar if in progress */}
                                    {isStarted && !isCompleted && (
                                        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/10">
                                            <div
                                                className="h-full bg-[#B7FF00] transition-all"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </main>
    );
}
