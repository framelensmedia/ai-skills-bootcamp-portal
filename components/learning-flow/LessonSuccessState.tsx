"use client";

import { Check, Sparkles, ArrowRight, Trophy, Flame, X } from "lucide-react";
import Link from "next/link";
import { Lesson } from "@/lib/types/learning-flow";
import { useEffect, useState } from "react";

type LessonSuccessStateProps = {
    lesson: Lesson;
    bootcampSlug: string;
    nextLesson?: Lesson | null;
    generationId?: string;
    isBootcampComplete?: boolean;
    onContinue?: () => void;
};

export default function LessonSuccessState({
    lesson,
    bootcampSlug,
    nextLesson,
    generationId,
    isBootcampComplete = false,
    onContinue,
    onClose,
}: LessonSuccessStateProps & { onClose?: () => void }) {
    const [showConfetti, setShowConfetti] = useState(true);
    const [showContent, setShowContent] = useState(false);

    useEffect(() => {
        // Stagger content reveal
        const timer1 = setTimeout(() => setShowContent(true), 300);
        const timer2 = setTimeout(() => setShowConfetti(false), 4000);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    return (
        <div className="relative">
            {/* Close Button */}
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute right-0 top-0 p-2 text-white/40 hover:text-white z-10 hover:bg-white/10 rounded-full transition"
                >
                    <X size={24} />
                </button>
            )}

            {/* Enhanced confetti effect */}
            {showConfetti && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Floating particles */}
                    {[...Array(12)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 rounded-full animate-confetti"
                            style={{
                                left: `${10 + (i * 7)}%`,
                                top: "-20px",
                                backgroundColor: i % 2 === 0 ? "#B7FF00" : i % 3 === 0 ? "#FFFFFF" : "#FFD700",
                                animationDelay: `${i * 100}ms`,
                                animationDuration: `${1500 + (i * 100)}ms`,
                            }}
                        />
                    ))}
                </div>
            )}

            <div
                className={`
          rounded-2xl border border-[#B7FF00]/30 bg-gradient-to-b from-[#B7FF00]/10 to-transparent p-8 text-center
          transition-all duration-500
          ${showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}
        `}
            >
                {/* Success icon */}
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#B7FF00] to-[#7ACC00] text-black shadow-lg shadow-[#B7FF00]/30 animate-bounce-once">
                    {isBootcampComplete ? (
                        <Trophy size={36} strokeWidth={2.5} />
                    ) : (
                        <Check size={36} strokeWidth={3} />
                    )}
                </div>

                {/* Success message */}
                {isBootcampComplete ? (
                    <>
                        <h2 className="text-3xl font-bold text-white mb-2">Bootcamp Complete! 🎉</h2>
                        <p className="text-white/60 mb-6">
                            Incredible work! You've finished all missions and built real AI skills.
                        </p>
                    </>
                ) : (
                    <>
                        <div className="flex justify-center mb-4">
                            <div className="flex items-center gap-2 bg-[#B7FF00]/10 border border-[#B7FF00]/20 rounded-full px-4 py-2 text-[#B7FF00]">
                                <span className="font-bold">+10 XP</span>
                                <span className="text-xs opacity-70">Lesson Complete</span>
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-2">Mission Complete!</h2>
                        <p className="text-white/60 mb-6">
                            You created something real. It's saved to your library.
                        </p>
                    </>
                )}

                {/* Achievement badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 border border-white/10 mb-6">
                    <Sparkles size={14} className="text-[#B7FF00]" />
                    <span className="text-sm font-medium text-white/80">
                        +1 Creation
                    </span>
                </div>

                {/* View creation link */}
                {generationId && (
                    <div className="mb-6">
                        <Link
                            href={`/library?highlight=${generationId}`}
                            className="inline-flex items-center gap-2 text-[#B7FF00] hover:underline"
                        >
                            <Sparkles size={16} />
                            <span>View your creation →</span>
                        </Link>
                    </div>
                )}

                {/* Next actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
                    {nextLesson ? (
                        <>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white font-semibold hover:bg-white/10 transition"
                            >
                                Back to Lesson
                            </button>
                            <Link
                                href={`/learn/${bootcampSlug}/${nextLesson.slug}`}
                                className="group flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#B7FF00] text-black font-bold hover:bg-[#a3e600] transition shadow-lg shadow-[#B7FF00]/20"
                            >
                                <span>Next Mission</span>
                                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                            </Link>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-white font-semibold hover:bg-white/10 transition"
                            >
                                Back to Lesson
                            </button>
                            <Link
                                href="/learn"
                                className="group flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#B7FF00] text-black font-bold hover:bg-[#a3e600] transition shadow-lg shadow-[#B7FF00]/20"
                            >
                                <span>Explore More</span>
                                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                            </Link>
                        </>
                    )}
                </div>

                {/* Motivation quote */}
                <p className="mt-10 text-sm text-white/30 italic">
                    "Every creation is a step forward. Keep building."
                </p>
            </div>

            {/* CSS animations */}
            <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(500px) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 2s ease-out forwards;
        }
        @keyframes bounce-once {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        .animate-bounce-once {
          animation: bounce-once 0.5s ease-out;
        }
      `}</style>
        </div>
    );
}
