"use client";

interface ModeToggleProps {
    mode: "auto" | "manual";
    onChange: (mode: "auto" | "manual") => void;
    disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
    return (
        <div className="flex items-center gap-4 mb-8">
            <span className="text-sm font-medium text-white/60 uppercase tracking-wider">Creation Mode</span>
            <div className="inline-flex gap-1 p-1 bg-[#111] rounded-lg border border-white/10">
                <button
                    type="button"
                    onClick={() => onChange("auto")}
                    disabled={disabled}
                    className={[
                        "px-6 py-2 text-sm font-bold uppercase tracking-wider rounded-md transition-all",
                        mode === "auto"
                            ? "bg-lime-400 text-black shadow-[0_0_15px_-3px_rgba(183,255,0,0.3)]"
                            : "text-white/60 hover:text-white hover:bg-[#111]",
                        disabled && "opacity-50 cursor-not-allowed",
                    ].join(" ")}
                >
                    Auto
                </button>
                <button
                    type="button"
                    onClick={() => onChange("manual")}
                    disabled={disabled}
                    className={[
                        "px-6 py-2 text-sm font-bold uppercase tracking-wider rounded-md transition-all",
                        mode === "manual"
                            ? "bg-lime-400 text-black shadow-[0_0_15px_-3px_rgba(183,255,0,0.3)]"
                            : "text-white/60 hover:text-white hover:bg-[#111]",
                        disabled && "opacity-50 cursor-not-allowed",
                    ].join(" ")}
                >
                    Manual
                </button>
            </div>
        </div>
    );
}
