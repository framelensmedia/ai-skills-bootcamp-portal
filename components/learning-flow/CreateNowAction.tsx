"use client";

import { Lesson, CreateActionPayload } from "@/lib/types/learning-flow";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";

type CreateNowActionProps = {
    lesson: Lesson;
    onComplete?: (generationId?: string) => void;
    disabled?: boolean;
};

export default function CreateNowAction({
    lesson,
    onComplete,
    disabled = false,
}: CreateNowActionProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const payload = lesson.create_action_payload;

    const handleCreate = () => {
        setLoading(true);

        // Route to Mission Studio for guaranteed round-trip completion
        const missionStudioUrl = `/studio/mission/${lesson.id}`;

        // Navigate to Mission Studio
        router.push(missionStudioUrl);
    };

    return (
        <div className="rounded-2xl border border-[#B7FF00]/20 bg-[#B7FF00]/5 p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B7FF00] text-black">
                    <Sparkles size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-white">Time to Create</h3>
                    <p className="text-sm text-white/60">Put what you learned into action</p>
                </div>
            </div>

            {/* Learning objective recap */}
            {lesson.learning_objective && (
                <div className="mb-6 rounded-xl bg-black/30 p-4 border border-white/5">
                    <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">
                        Your Goal
                    </div>
                    <p className="text-sm text-white/80">{lesson.learning_objective}</p>
                </div>
            )}

            {/* Create description */}
            {lesson.create_action_description && (
                <p className="text-sm text-white/70 mb-6">{lesson.create_action_description}</p>
            )}

            {/* Create button */}
            <button
                onClick={handleCreate}
                disabled={disabled || loading}
                className="
          group flex w-full items-center justify-center gap-3 rounded-xl 
          bg-[#B7FF00] px-6 py-4 text-base font-bold text-black 
          transition-all hover:bg-[#a3e600] hover:scale-[1.02]
          disabled:opacity-50 disabled:hover:scale-100
        "
            >
                {loading ? (
                    <>
                        <Loader2 size={20} className="animate-spin" />
                        <span>Opening Studio...</span>
                    </>
                ) : (
                    <>
                        <span>{lesson.create_action_label || "Create Now"}</span>
                        <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                    </>
                )}
            </button>

            {/* Action type indicator */}
            <div className="mt-4 text-center text-xs text-white/40">
                {lesson.create_action_type === "prompt_template" && "Opens Prompt Studio with template"}
                {lesson.create_action_type === "template_pack" && "Opens template pack selection"}
                {lesson.create_action_type === "guided_remix" && "Opens Guided Remix wizard"}
            </div>
        </div>
    );
}
