"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Play, Check, Clock, FileQuestion, ArrowRight, HelpCircle, Sparkles, Zap, Type } from "lucide-react";
import { LessonContentItem } from "@/components/cms/LessonContentManager";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

type Props = {
    items: LessonContentItem[];
    lessonId: string;
    onAllCompleted: () => void;
    initialCompletedIds?: Set<string>;
};

// Helper: Get embed URL
function getEmbedUrl(url: string): string {
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
        const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?\/]+)/);
        if (match) return `https://www.youtube.com/embed/${match[1]}?autoplay=1`;
    }
    if (url.includes("vimeo.com")) {
        const match = url.match(/vimeo\.com\/(\d+)/);
        if (match) return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;
    }
    return url;
}

function isDirectVideo(url: string): boolean {
    return url.match(/\.(mp4|webm|mov|m3u8)(\?|$)/i) !== null;
}

export default function ContentStepper({ items, lessonId, onAllCompleted, initialCompletedIds = new Set() }: Props) {
    const router = useRouter();
    const hasCalledCompletionRef = useRef(false);

    // Initialize derived state
    const orderedItems = useMemo(() => {
        return [...items].sort((a, b) => a.order_index - b.order_index);
    }, [items]);

    // Initialize completion state from props
    const [completedIndexes, setCompletedIndexes] = useState<Set<number>>(() => {
        const initial = new Set<number>();
        orderedItems.forEach((item, index) => {
            if (item.id && initialCompletedIds.has(item.id)) {
                initial.add(index);
            }
        });
        return initial;
    });

    // Initialize current index to first uncompleted item
    const [currentIndex, setCurrentIndex] = useState(() => {
        const firstUncompleted = orderedItems.findIndex((item, index) => {
            const isCompleted = item.id && initialCompletedIds.has(item.id);
            return !isCompleted;
        });
        return firstUncompleted === -1 ? 0 : firstUncompleted;
    });

    // Next Up state
    const [showNextUp, setShowNextUp] = useState(false);
    const [countdown, setCountdown] = useState(5);

    const currentItem = orderedItems[currentIndex];
    const totalDuration = orderedItems.reduce((sum, item) => sum + (item.content.duration_seconds || 0), 0);

    // Reset loop state on index change
    useEffect(() => {
        setShowNextUp(false);
        setCountdown(5);

        // Auto-complete celebration block when reached
        if (orderedItems[currentIndex]?.type === 'celebration') {
            markCompleted(currentIndex);
        }
    }, [currentIndex, orderedItems]);

    // Watch for All Completed
    useEffect(() => {
        if (orderedItems.length > 0 && completedIndexes.size === orderedItems.length) {
            if (!hasCalledCompletionRef.current) {
                hasCalledCompletionRef.current = true;
                onAllCompleted();
            }
        }
    }, [completedIndexes, orderedItems.length, onAllCompleted]);

    // Countdown Timer logic
    useEffect(() => {
        if (!showNextUp || countdown <= 0) return;
        const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
        return () => clearInterval(timer);
    }, [showNextUp, countdown]);

    // Auto-advance
    useEffect(() => {
        if (countdown === 0 && showNextUp) {
            handleNext();
        }
    }, [countdown, showNextUp]);

    async function markCompleted(index: number) {
        const item = orderedItems[index];

        // Optimistic update using functional state to ensure freshness
        setCompletedIndexes(prev => {
            const newCompleted = new Set(prev);
            newCompleted.add(index);
            return newCompleted;
        });

        // Call API to persist
        if (item.id) {
            try {
                await fetch("/api/learn/progress", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lesson_id: lessonId,
                        content_id: item.id,
                        is_completed: true
                    })
                });
            } catch (e) {
                console.error("Failed to save progress:", e);
            }
        }
    }

    function handleVideoEnd() {
        console.log("Video ended, marking complete:", currentIndex);
        markCompleted(currentIndex);
        if (currentIndex < orderedItems.length - 1) {
            setShowNextUp(true);
        }
    }

    function handleNext() {
        if (currentIndex < orderedItems.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }

    const searchParams = useSearchParams();
    const hasProcessedCompletionRef = useRef(false);

    // Check for completion signal from Studio (run once)
    useEffect(() => {
        if (hasProcessedCompletionRef.current) return;
        if (searchParams?.get("completed") === "true") {
            hasProcessedCompletionRef.current = true;
            // Find the exercise step and mark it complete
            const exerciseIndex = orderedItems.findIndex(item => item.type === "exercise");
            if (exerciseIndex !== -1) {
                markCompleted(exerciseIndex);
                setCurrentIndex(exerciseIndex);
            }
        }
    }, [searchParams, orderedItems]);

    function handleActionStart() {
        // Redirect to the standard Studio with the template
        const templateId = currentItem.content.explanation;
        if (templateId) {
            router.push(`/studio?promptId=${templateId}`);
        } else {
            console.error("No template ID found for action");
        }
    }

    if (orderedItems.length === 0) {
        return <div className="text-white/40 text-center py-8">No content available.</div>;
    }

    return (
        <div className="space-y-4">
            {/* Progress Header */}
            <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-[#B7FF00]">
                        Step {currentIndex + 1} of {orderedItems.length}
                    </span>
                    <span className="text-white/40">
                        {completedIndexes.size}/{orderedItems.length} completed
                    </span>
                </div>
                {totalDuration > 0 && (
                    <div className="flex items-center gap-1 text-white/40">
                        <Clock size={14} />
                        <span>{Math.ceil(totalDuration / 60)} min</span>
                    </div>
                )}
            </div>

            {/* Step Indicators */}
            <div className="flex gap-2 mb-4">
                {orderedItems.map((item, index) => (
                    <button
                        key={item.id || index}
                        onClick={() => setCurrentIndex(index)}
                        className={`flex-1 h-1.5 rounded-full transition-all ${index === currentIndex ? "bg-[#B7FF00]"
                            : completedIndexes.has(index) ? "bg-[#B7FF00]/40"
                                : "bg-white/10"
                            }`}
                        title={item.title}
                    />
                ))}
            </div>

            {/* Main Content Viewer */}
            <div className="group relative rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 aspect-video flex flex-col">

                {/* VIDEO RENDERER */}
                {currentItem.type === "video" && (
                    <div className="absolute inset-0 bg-black group-hover:block">
                        {currentItem.content.video_url && isDirectVideo(currentItem.content.video_url) ? (
                            <video
                                key={currentItem.id || currentIndex}
                                src={currentItem.content.video_url}
                                controls={!showNextUp}
                                onEnded={handleVideoEnd}
                                className="w-full h-full"
                                playsInline
                                autoPlay={currentIndex > 0}
                            />
                        ) : currentItem.content.video_url ? (
                            <iframe
                                key={currentItem.id || currentIndex}
                                src={getEmbedUrl(currentItem.content.video_url)}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-white/40">
                                Video URL not found
                            </div>
                        )}

                        {/* Manual Complete Control (Fallback for videos) */}
                        {!showNextUp && (
                            <div className="absolute bottom-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                {!completedIndexes.has(currentIndex) ? (
                                    <button
                                        onClick={() => {
                                            markCompleted(currentIndex);
                                            // Handle manual trigger behavior (next up or just complete)
                                            if (currentIndex < orderedItems.length - 1) {
                                                setShowNextUp(true);
                                            }
                                        }}
                                        className="px-4 py-2 bg-black/60 hover:bg-black/80 text-white text-xs font-medium rounded-lg border border-white/10 backdrop-blur-md transition flex items-center gap-2"
                                    >
                                        <Check size={14} /> Mark Complete
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleNext}
                                        className="px-4 py-2 bg-[#B7FF00] hover:bg-[#a3e600] text-black text-xs font-bold rounded-lg shadow-lg transition flex items-center gap-2"
                                    >
                                        Next Step <ArrowRight size={14} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* TEXT RENDERER */}
                {currentItem.type === "text" && (
                    <div className="absolute inset-0 bg-zinc-900 p-8 flex flex-col items-center justify-center overflow-y-auto">
                        <div className="max-w-2xl w-full space-y-6">
                            <div className="flex justify-center mb-4">
                                <div className="p-3 rounded-full bg-blue-500/10 text-blue-400">
                                    <Type size={32} />
                                </div>
                            </div>
                            <div className="prose prose-invert prose-lg mx-auto">
                                {/* Simple whitespace rendering for V1, or basic markdown if we had a renderer */}
                                {(currentItem.content.question || "").split('\n').map((line, i) => (
                                    <p key={i} className="min-h-[1em]">{line}</p>
                                ))}
                            </div>
                            <div className="flex justify-center pt-8">
                                <button
                                    onClick={() => {
                                        markCompleted(currentIndex);
                                        handleNext();
                                    }}
                                    className="px-8 py-3 rounded-full bg-white text-black font-bold hover:bg-white/90 transition"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ACTION (EXERCISE) RENDERER */}
                {currentItem.type === "exercise" && (
                    <div className="absolute inset-0 bg-zinc-900 p-8 flex flex-col items-center justify-center text-center animate-in fade-in">
                        <div className="w-full max-w-lg">
                            <div className="mb-6 flex justify-center">
                                <div className="rounded-full bg-[#B7FF00]/10 p-6 text-[#B7FF00] animate-pulse">
                                    <Zap size={48} />
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-2">
                                {currentItem.title || "Your Turn"}
                            </h3>
                            <p className="text-white/60 mb-8">
                                Use the template below to create your own version.
                            </p>

                            {/* Template Preview Card */}
                            {currentItem.content.options && currentItem.content.options.length > 0 && (
                                <div className="mb-8 p-4 rounded-xl border border-white/10 bg-white/5 flex items-center gap-4 text-left">
                                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-black shrink-0">
                                        {currentItem.content.options[1] ? (
                                            <Image
                                                src={currentItem.content.options[1]}
                                                alt=""
                                                fill
                                                className="object-cover"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                                <Sparkles size={20} />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-white">{currentItem.content.options[0]}</div>
                                        <div className="text-xs text-white/40">Ready to remix</div>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleActionStart}
                                className={`w-full rounded-lg py-4 font-bold transition transform hover:scale-105 shadow-xl ${completedIndexes.has(currentIndex)
                                    ? "bg-white text-black hover:bg-white/90"
                                    : "bg-[#B7FF00] text-black hover:bg-[#a3e600] shadow-[#B7FF00]/10"
                                    }`}
                            >
                                {completedIndexes.has(currentIndex) ? (
                                    <>
                                        <Sparkles size={18} className="inline mr-2" />
                                        Remix Again
                                    </>
                                ) : (
                                    <>
                                        {currentItem.content.description || "Create Now"} <ArrowRight size={18} className="inline ml-2" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* CELEBRATION RENDERER */}
                {currentItem.type === "celebration" && (
                    <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center text-center animate-in zoom-in-95 duration-500">
                        <div className="mb-6 rounded-full bg-[#B7FF00]/10 p-6 text-[#B7FF00] animate-bounce">
                            <span className="text-4xl">🎉</span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Lesson Completed!</h3>
                        <p className="text-white/60 mb-8">Great job finishing this section.</p>
                        <button
                            onClick={() => {
                                // Ensure modal triggers if not already
                                if (completedIndexes.size < orderedItems.length) {
                                    markCompleted(currentIndex);
                                } else {
                                    onAllCompleted();
                                }
                            }}
                            className="rounded-lg bg-[#B7FF00] px-8 py-3 font-bold text-black hover:bg-[#a3e600] transition transform hover:scale-105"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {/* NEXT UP OVERLAY */}
                {showNextUp && currentIndex < orderedItems.length - 1 && (
                    <div className="absolute bottom-4 right-4 z-10 max-w-sm rounded-xl border border-white/10 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in">
                        <div className="flex items-start gap-4">
                            <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-black">
                                {orderedItems[currentIndex + 1].type === "video" && orderedItems[currentIndex + 1].content.thumbnail_url && (
                                    <img
                                        src={orderedItems[currentIndex + 1].content.thumbnail_url!}
                                        className="h-full w-full object-cover opacity-50"
                                        alt=""
                                    />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="font-mono text-xl font-bold text-white">{countdown}</span>
                                </div>
                                <svg className="absolute inset-0 h-full w-full -rotate-90">
                                    <circle
                                        cx="50%"
                                        cy="50%"
                                        r="20"
                                        fill="none"
                                        stroke="#B7FF00"
                                        strokeWidth="4"
                                        strokeDasharray="126"
                                        strokeDashoffset={126 - (126 * (5 - countdown)) / 5}
                                        className="transition-all duration-1000 ease-linear"
                                    />
                                </svg>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium uppercase text-white/50 mb-1">Up Next</p>
                                <h4 className="font-bold text-sm truncate text-white mb-3">
                                    {orderedItems[currentIndex + 1].title || `Step ${currentIndex + 2}`}
                                </h4>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowNextUp(false)}
                                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleNext}
                                        className="rounded-lg bg-[#B7FF00] px-3 py-1.5 text-xs font-medium text-black hover:bg-[#a3e600]"
                                    >
                                        Start Now
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Info Area (Below) */}
            <div className="p-4 border border-white/10 rounded-xl bg-zinc-900/50">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="font-semibold mb-1">
                            {currentItem.title}
                        </h3>
                        <div className="text-sm text-white/60 mb-2">
                            {currentItem.type.charAt(0).toUpperCase() + currentItem.type.slice(1)}
                        </div>
                        {currentItem.content.description && (
                            <p className="text-sm text-white/80 max-w-2xl leading-relaxed">
                                {currentItem.content.description}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {completedIndexes.has(currentIndex) ? (
                            <div className="flex items-center gap-1 text-[#B7FF00] text-xs">
                                <Check size={14} />
                                Completed
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

        </div>
    );
}
