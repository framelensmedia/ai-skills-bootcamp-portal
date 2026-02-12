"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Check, ArrowRight, Sparkles, Users, BookOpen } from "lucide-react";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    lessonTitle: string;
    nextLessonSlug?: string;
    bootcampSlug: string;
    onCreateClick: () => void;
};

export default function LessonCompleteModal({
    isOpen,
    onClose,
    lessonTitle,
    nextLessonSlug,
    bootcampSlug,
    onCreateClick
}: Props) {
    const { width, height } = useWindowSize();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <Confetti
                width={width}
                height={height}
                recycle={false}
                numberOfPieces={500}
                gravity={0.15}
            />

            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-[#B7FF00]/30 bg-zinc-900 shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-[#B7FF00]/10 p-8 text-center border-b border-[#B7FF00]/10">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#B7FF00]/20 text-[#B7FF00]">
                        <Check size={32} strokeWidth={3} />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Mission Complete!</h2>
                    <p className="text-white/60">
                        You've mastered <span className="text-white font-medium">"{lessonTitle}"</span>
                    </p>
                </div>

                {/* Content */}
                <div className="p-8">
                    <p className="text-center text-white/50 mb-8 max-w-md mx-auto">
                        Great work! You've learned the concepts. Now, what would you like to do next?
                    </p>

                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                        {/* Option 1: Create */}
                        <button
                            onClick={onCreateClick}
                            className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-[#B7FF00] hover:bg-[#B7FF00]/5"
                        >
                            <div className="rounded-full bg-white/10 p-3 text-white transition group-hover:bg-[#B7FF00] group-hover:text-black">
                                <Sparkles size={24} />
                            </div>
                            <div className="text-center">
                                <h3 className="font-bold text-white group-hover:text-[#B7FF00]">Create Now</h3>
                                <p className="text-xs text-white/40 mt-1">Apply your skills in the Studio</p>
                            </div>
                        </button>

                        {/* Option 2: Learn Next */}
                        {nextLessonSlug ? (
                            <Link
                                href={`/learn/${bootcampSlug}/${nextLessonSlug}`}
                                className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-blue-400 hover:bg-blue-400/5"
                            >
                                <div className="rounded-full bg-white/10 p-3 text-white transition group-hover:bg-blue-400 group-hover:text-black">
                                    <BookOpen size={24} />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-white group-hover:text-blue-400">Next Lesson</h3>
                                    <p className="text-xs text-white/40 mt-1">Continue your learning streak</p>
                                </div>
                            </Link>
                        ) : (
                            <Link
                                href={`/learn/${bootcampSlug}`}
                                className="group relative flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 transition hover:border-purple-400 hover:bg-purple-400/5"
                            >
                                <div className="rounded-full bg-white/10 p-3 text-white transition group-hover:bg-purple-400 group-hover:text-black">
                                    <ArrowRight size={24} />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-bold text-white group-hover:text-purple-400">Finish Bootcamp</h3>
                                    <p className="text-xs text-white/40 mt-1">Return to overview</p>
                                </div>
                            </Link>
                        )}
                    </div>

                    {/* Option 3: Community (Secondary) */}
                    <div className="text-center">
                        <Link
                            href="/community"
                            className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition"
                        >
                            <Users size={14} />
                            See what others are building in Community
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
