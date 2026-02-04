"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Check, Play, Clock, BookOpen, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";

type Bootcamp = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    thumbnail_url: string | null;
    lesson_count: number;
};

type BootcampProgress = {
    bootcamp_id: string;
    completed_lessons: number;
    total_lessons: number;
    status: string;
};

type Props = {
    className?: string;
};

export default function BasicTrainingCards({ className = "" }: Props) {
    const { user } = useAuth();
    const router = useRouter();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [bootcamps, setBootcamps] = useState<Bootcamp[]>([]);
    const [progress, setProgress] = useState<Map<string, BootcampProgress>>(new Map());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadBasicTraining();
    }, [user]);

    async function loadBasicTraining() {
        try {
            // Fetch basic training bootcamps
            const { data: bootcampData } = await supabase
                .from("bootcamps")
                .select(`
          id, title, slug, description, thumbnail_url,
          lessons:lessons(count)
        `)
                .eq("bootcamp_type", "basic_training")
                .eq("is_published", true)
                .order("created_at", { ascending: true });

            if (bootcampData) {
                const mapped = bootcampData.map((b: any) => ({
                    ...b,
                    lesson_count: b.lessons?.[0]?.count || 0,
                }));
                setBootcamps(mapped);
            }

            // Fetch user progress if logged in
            if (user) {
                const { data: progressData } = await supabase
                    .from("bootcamp_progress")
                    .select("bootcamp_id, completed_lessons, total_lessons, status")
                    .eq("user_id", user.id);

                if (progressData) {
                    const progressMap = new Map<string, BootcampProgress>();
                    progressData.forEach((p: any) => {
                        progressMap.set(p.bootcamp_id, p);
                    });
                    setProgress(progressMap);
                }
            }
        } catch (e) {
            console.error("Failed to load basic training:", e);
        } finally {
            setLoading(false);
        }
    }

    function getBootcampStatus(bootcampId: string): "not_started" | "in_progress" | "completed" {
        const p = progress.get(bootcampId);
        if (!p) return "not_started";
        if (p.status === "completed") return "completed";
        if (p.completed_lessons > 0) return "in_progress";
        return "not_started";
    }

    function getProgressPercent(bootcampId: string): number {
        const p = progress.get(bootcampId);
        if (!p || !p.total_lessons) return 0;
        return Math.round((p.completed_lessons / p.total_lessons) * 100);
    }

    if (loading) {
        return (
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${className}`}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
                        <div className="aspect-[16/10] rounded-xl bg-white/10" />
                        <div className="mt-4 h-4 w-20 rounded bg-white/10" />
                        <div className="mt-2 h-5 w-3/4 rounded bg-white/10" />
                        <div className="mt-2 h-4 w-full rounded bg-white/10" />
                    </div>
                ))}
            </div>
        );
    }

    // If no basic training bootcamps, show placeholder cards
    if (bootcamps.length === 0) {
        return (
            <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${className}`}>
                {/* Placeholder cards matching original design */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20">
                    <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/40" />
                    <p className="mt-4 text-xs font-semibold text-[#B7FF00]">
                        REMIXING
                        <span className="ml-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/60">
                            COMING SOON
                        </span>
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-white">How to remix prompts for your offer</h3>
                    <p className="mt-2 text-sm text-white/60">Swap in product images, change the headline, and keep the style locked.</p>
                    <div className="mt-4">
                        <span className="text-xs text-white/60 hover:text-white">Preview →</span>
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20">
                    <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/40" />
                    <p className="mt-4 text-xs font-semibold text-[#B7FF00]">
                        REFERENCE IMAGES
                        <span className="ml-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/60">
                            COMING SOON
                        </span>
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-white">How to use uploads for better results</h3>
                    <p className="mt-2 text-sm text-white/60">Upload up to 10 images to guide style, layout, and branding.</p>
                    <div className="mt-4">
                        <span className="text-xs text-white/60 hover:text-white">Preview →</span>
                    </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 hover:border-white/20">
                    <div className="aspect-[16/10] rounded-xl bg-gradient-to-br from-white/10 to-black/40" />
                    <p className="mt-4 text-xs font-semibold text-[#B7FF00]">
                        WORKFLOW
                        <span className="ml-2 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-white/60">
                            COMING SOON
                        </span>
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-white">Prompt → Studio → Library</h3>
                    <p className="mt-2 text-sm text-white/60">Use prompts for speed, Studio for custom work, Library to reuse winners.</p>
                    <div className="mt-4">
                        <span className="text-xs text-white/60 hover:text-white">Preview →</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`grid grid-cols-1 gap-5 md:grid-cols-3 ${className}`}>
            {bootcamps.map((bootcamp) => {
                const status = getBootcampStatus(bootcamp.id);
                const progressPercent = getProgressPercent(bootcamp.id);
                const isStarted = status !== "not_started";
                const isCompleted = status === "completed";

                return (
                    <Link
                        key={bootcamp.id}
                        href={`/learn/${bootcamp.slug}`}
                        onClick={(e) => {
                            if (!user) {
                                e.preventDefault();
                                router.push("/login");
                            }
                        }}
                        className={`
              group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300
              ${isCompleted
                                ? "border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent hover:border-green-500/40"
                                : isStarted
                                    ? "border-[#B7FF00]/20 bg-gradient-to-br from-[#B7FF00]/5 to-transparent hover:border-[#B7FF00]/40"
                                    : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                            }
            `}
                    >
                        {/* Thumbnail */}
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-black">
                            {bootcamp.thumbnail_url ? (
                                <Image
                                    src={bootcamp.thumbnail_url}
                                    alt={bootcamp.title}
                                    fill
                                    className="object-cover transition duration-500 group-hover:scale-105"
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                                        <BookOpen size={24} className="text-white/20" />
                                    </div>
                                </div>
                            )}

                            {/* Gradient Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60" />

                            {/* Status badge */}
                            <div className="absolute top-3 right-3">
                                {isCompleted && (
                                    <div className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/20 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-green-400 shadow-lg">
                                        <Check size={10} strokeWidth={3} />
                                        COMPLETE
                                    </div>
                                )}
                                {!isCompleted && isStarted && (
                                    <div className="flex items-center gap-1.5 rounded-full border border-[#B7FF00]/30 bg-[#B7FF00]/20 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-[#B7FF00] shadow-lg">
                                        <Play size={10} fill="currentColor" />
                                        {progressPercent}%
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex flex-1 flex-col p-5">
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                                    Basic Training
                                </span>
                                <span className="flex items-center gap-1 text-[10px] font-medium text-white/40">
                                    <Clock size={10} />
                                    {bootcamp.lesson_count} missions
                                </span>
                            </div>

                            <h3 className="text-lg font-bold leading-tight text-white group-hover:text-[#B7FF00] transition-colors mb-2">
                                {bootcamp.title}
                            </h3>

                            {bootcamp.description && (
                                <p className="text-sm leading-relaxed text-white/50 line-clamp-2 mb-4">
                                    {bootcamp.description}
                                </p>
                            )}

                            <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                {/* Progress bar for in-progress */}
                                {isStarted && !isCompleted ? (
                                    <div className="flex-1 mr-4">
                                        <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                                            <div
                                                className="h-full bg-[#B7FF00] rounded-full"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                        <p className="mt-1.5 text-[10px] font-medium text-[#B7FF00]">Resume Mission</p>
                                    </div>
                                ) : (
                                    <span className={`text-xs font-semibold ${isCompleted ? "text-green-400" : "text-white group-hover:text-[#B7FF00]"
                                        } transition-colors flex items-center gap-2`}>
                                        {isCompleted ? "Review Bootcamp" : "Start Bootcamp"}
                                    </span>
                                )}

                                <div className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 ${isCompleted
                                    ? "border-green-500/30 bg-green-500/10 text-green-400 group-hover:bg-green-500 group-hover:text-black group-hover:border-green-500"
                                    : isStarted
                                        ? "border-[#B7FF00]/30 bg-[#B7FF00]/10 text-[#B7FF00] group-hover:bg-[#B7FF00] group-hover:text-black group-hover:border-[#B7FF00]"
                                        : "border-white/10 bg-white/5 text-white/40 group-hover:border-[#B7FF00] group-hover:bg-[#B7FF00] group-hover:text-black"
                                    }`}>
                                    <ArrowRight size={14} className="-ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
