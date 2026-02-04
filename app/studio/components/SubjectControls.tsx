
import React from 'react';

interface SubjectControlsProps {
    subjectMode: "human" | "non_human";
    setSubjectMode: (mode: "human" | "non_human") => void;
    subjectLock: boolean;
    setSubjectLock: (lock: boolean) => void;
    keepOutfit: boolean;
    setKeepOutfit: (keep: boolean) => void;
}

export default function SubjectControls({
    subjectMode,
    setSubjectMode,
    subjectLock,
    setSubjectLock,
    keepOutfit,
    setKeepOutfit
}: SubjectControlsProps) {
    return (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-3">
            <div className="flex flex-col gap-2">
                {/* Mode Selector */}
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-1">
                    <button
                        type="button"
                        onClick={() => setSubjectMode("human")}
                        className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition ${subjectMode === "human" ? "bg-lime-400 text-black shadow-md" : "text-white/60 hover:text-white"}`}
                    >
                        Human
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubjectMode("non_human")}
                        className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition ${subjectMode === "non_human" ? "bg-lime-400 text-black shadow-md" : "text-white/60 hover:text-white"}`}
                    >
                        Object
                    </button>
                </div>

                {/* Strict Lock Toggle */}
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2 px-3">
                    <input
                        type="checkbox"
                        checked={subjectLock}
                        onChange={(e) => setSubjectLock(e.target.checked)}
                        className="h-3 w-3 rounded border-lime-400 bg-transparent text-lime-400 focus:ring-lime-400 accent-lime-400"
                        id="studio-subject-lock-inline"
                    />
                    <label htmlFor="studio-subject-lock-inline" className="flex-1 cursor-pointer select-none text-xs text-white flex flex-col">
                        <span className="font-bold">Face Lock</span>
                        <span className="text-[9px] text-white/50">Maintain identity & gaze</span>
                    </label>
                </div>

                {/* Keep Outfit Toggle */}

            </div>
        </div>
    );
}
