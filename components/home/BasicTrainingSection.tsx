"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Rocket, ArrowRight, Play, CheckCircle } from "lucide-react";
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

export default function BasicTrainingSection({ className = "" }: Props) {
    const { user } = useAuth();
    const supabase = useMemo(() => createSupabaseBrowserClient(), []);

    const [bootcamps, setBootcamps] = useState<Bootcamp[]>([]);
    const [progress, setProgress] = useState<Map<string, BootcampProgress>>(new Map());
    const [loading, setLoading] = useState(true);
    const [activeBootcamp, setActiveBootcamp] = useState<Bootcamp | null>(null);
    const [nextMissionUrl, setNextMissionUrl] = useState("/learn");

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

            // Fetch user progress
            let progressMap = new Map<string, BootcampProgress>();
            if (user) {
                const { data: progressData } = await supabase
                    .from("bootcamp_progress")
                    .select("bootcamp_id, completed_lessons, total_lessons, status")
                    .eq("user_id", user.id);

                if (progressData) {
                    progressData.forEach((p: any) => {
                        progressMap.set(p.bootcamp_id, p);
                    });
                    setProgress(progressMap);
                }
            }

            // Determine ACTIVE bootcamp
            if (bootcampData && bootcampData.length > 0) {
                let foundActive = false;

                for (const bootcamp of bootcampData) {
                    const bp = progressMap.get(bootcamp.id);
                    const isComplete = bp?.status === "completed";

                    if (!isComplete) {
                        setActiveBootcamp({
                            ...bootcamp,
                            lesson_count: bootcamp.lessons?.[0]?.count || 0
                        });

                        // Resume URL logic
                        if (bp && bp.completed_lessons > 0) {
                            // Optimization: link to bootcamp, page helper will redirect/resume
                            setNextMissionUrl(`/learn/${bootcamp.slug}`);
                        } else {
                            setNextMissionUrl(`/learn/${bootcamp.slug}`);
                        }
                        foundActive = true;
                        break;
                    }
                }

                // Fallback to last if all complete
                if (!foundActive) {
                    const last = bootcampData[bootcampData.length - 1];
                    setActiveBootcamp({
                        ...last,
                        lesson_count: last.lessons?.[0]?.count || 0
                    });
                    setNextMissionUrl(`/learn/${last.slug}`);
                }
            }

        } catch (e) {
            console.error("Failed to load basic training:", e);
        } finally {
            setLoading(false);
        }
    }

    if (loading || !activeBootcamp) {
        return null;
    }

    const activeProgress = progress.get(activeBootcamp.id);
    const isStarted = activeProgress && activeProgress.completed_lessons > 0;
    const isComplete = activeProgress && activeProgress.status === "completed";
    const progressPercent = activeProgress && activeProgress.total_lessons > 0
        ? Math.round((activeProgress.completed_lessons / activeProgress.total_lessons) * 100)
        : 0;

    return (
        <section className={`mx-auto max-w-6xl px-4 py-12 ${className}`}>

            {/* 2-Column Split Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-zinc-900/40 border border-white/5 rounded-3xl p-6 md:p-8 backdrop-blur-sm hover:border-[#B7FF00]/20 transition-all duration-500 group">

                {/* LEFT: Featured Image */}
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
                    <Link href={nextMissionUrl} className="block h-full w-full">
                        {activeBootcamp.thumbnail_url ? (
                            <Image
                                src={activeBootcamp.thumbnail_url}
                                alt={activeBootcamp.title}
                                fill
                                className="object-cover transition duration-700 group-hover:scale-105"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                                <Rocket size={48} className="text-white/10" />
                            </div>
                        )}

                        {/* Play Button Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#B7FF00] text-black shadow-lg shadow-[#B7FF00]/20 transform transition-transform duration-300 group-hover:scale-110">
                                {isComplete ? (
                                    <CheckCircle size={28} />
                                ) : (
                                    <Play size={28} fill="currentColor" className="ml-1" />
                                )}
                            </div>
                        </div>

                        {/* Progress Bar Overlay (Bottom of image) */}
                        {isStarted && !isComplete && (
                            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50">
                                <div className="h-full bg-[#B7FF00]" style={{ width: `${progressPercent}%` }} />
                            </div>
                        )}
                    </Link>
                </div>

                {/* RIGHT: Copy & CTA */}
                <div className="flex flex-col justify-center text-left">

                    {/* Header / Eyebrow */}
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#B7FF00]/10 text-[#B7FF00]">
                            <Rocket size={12} />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-[#B7FF00]">
                            Basic Training Flight
                        </span>
                    </div>

                    {/* Headline */}
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight tracking-tight">
                        Free AI Training
                    </h2>

                    {/* Description */}
                    <p className="text-lg text-white/60 mb-8 leading-relaxed">
                        {activeBootcamp.description || "Master the basics of AI creation in minutes. No experience required."}
                    </p>

                    {/* CTA */}
                    <div>
                        <Link
                            href={nextMissionUrl}
                            className="inline-flex items-center gap-3 bg-[#B7FF00] text-black px-8 py-4 rounded-xl font-bold text-lg hover:bg-[#a3e600] active:scale-95 transition-all shadow-[0_0_20px_-5px_rgba(183,255,0,0.3)] hover:shadow-[0_0_30px_-5px_rgba(183,255,0,0.5)]"
                        >
                            {isComplete ? "Review Mission" : isStarted ? "Resume Mission" : "Start Basic Training"}
                            <ArrowRight size={20} />
                        </Link>

                        {/* Subtext */}
                        {!isComplete && (
                            <p className="mt-4 text-xs text-white/30 font-medium">
                                {activeBootcamp.lesson_count} lessons • ~5 min
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
