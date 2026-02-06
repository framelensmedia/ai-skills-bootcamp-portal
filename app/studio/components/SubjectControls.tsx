
import React from 'react';

interface SubjectControlsProps {
    subjectMode: "human" | "non_human";
    setSubjectMode: (mode: "human" | "non_human") => void;
    subjectLock: boolean;
    setSubjectLock: (lock: boolean) => void;
    subjectOutfit: string;
    setSubjectOutfit: (outfit: string) => void;
    keepOutfit: boolean;
    setKeepOutfit: (keep: boolean) => void;
}

export default function SubjectControls({
    subjectMode,
    setSubjectMode,
    subjectLock,
    setSubjectLock,
    subjectOutfit,
    setSubjectOutfit,
    keepOutfit,
    setKeepOutfit
}: SubjectControlsProps) {
    return (
        <div className="mt-2 pt-2 border-t border-white/5 space-y-3">
            <div className="flex flex-col gap-3">
                {/* Mode Selector */}
                <div>
                    <div className="text-[10px] uppercase font-bold text-white/50 mb-1 px-1">Subject Type</div>
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-1">
                        <button
                            type="button"
                            onClick={() => setSubjectMode("human")}
                            className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition ${subjectMode === "human" ? "bg-lime-400 text-black shadow-md" : "text-white/60 hover:text-white"}`}
                        >
                            Person
                        </button>
                        <button
                            type="button"
                            onClick={() => setSubjectMode("non_human")}
                            className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition ${subjectMode === "non_human" ? "bg-lime-400 text-black shadow-md" : "text-white/60 hover:text-white"}`}
                        >
                            Object / Product
                        </button>
                    </div>
                </div>

                {/* Human Options */}
                {subjectMode === "human" && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Outfit Mode */}
                        <div>
                            <div className="text-[10px] uppercase font-bold text-white/50 mb-1 px-1">Clothing</div>
                            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-1">
                                <button
                                    type="button"
                                    onClick={() => setKeepOutfit(true)}
                                    className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition ${keepOutfit ? "bg-white/20 text-white shadow-sm" : "text-white/40 hover:text-white"}`}
                                >
                                    Keep Original
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setKeepOutfit(false)}
                                    className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition ${!keepOutfit ? "bg-white/20 text-white shadow-sm" : "text-white/40 hover:text-white"}`}
                                >
                                    Use Template
                                </button>
                            </div>
                        </div>

                        {/* Strict Lock Toggle */}
                        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-2 px-3">
                            <input
                                type="checkbox"
                                checked={subjectLock}
                                onChange={(e) => setSubjectLock(e.target.checked)}
                                className="mt-1 h-3.5 w-3.5 rounded border-lime-400 bg-transparent text-lime-400 focus:ring-lime-400 accent-lime-400"
                                id="studio-subject-lock-inline"
                            />
                            <label htmlFor="studio-subject-lock-inline" className="flex-1 cursor-pointer select-none text-xs text-white flex flex-col">
                                <span className="font-bold">Identity Lock</span>
                                <span className="text-[10px] text-white/50 mt-0.5">Strictly preserve facial features & gaze. Uncheck to allow more creative blending.</span>
                            </label>
                        </div>

                        {/* Custom Outfit Input (Only if changing outfit) */}
                        {!keepOutfit && (
                            <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-2 px-3">
                                    <label htmlFor="studio-subject-outfit" className="text-[10px] uppercase font-bold text-white/70">
                                        Describe New Outfit
                                    </label>
                                    <input
                                        type="text"
                                        value={subjectOutfit}
                                        onChange={(e) => setSubjectOutfit(e.target.value)}
                                        placeholder="Leave blank to match template..."
                                        className="w-full bg-transparent text-xs text-white placeholder:text-white/30 outline-none border-b border-white/10 focus:border-lime-400 py-1 transition-colors"
                                        id="studio-subject-outfit"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
