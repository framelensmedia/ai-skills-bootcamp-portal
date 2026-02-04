import React from "react";

export default function SelectPill({
    label,
    description,
    icon,
    disabled,
    selected,
    onClick,
}: {
    label: string;
    description?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
    selected?: boolean;
    onClick?: () => void;
}) {
    const base = "group relative flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition-all active:scale-[0.98] h-full";
    const disabledCls = "cursor-not-allowed border-white/5 bg-white/5 text-white/20";
    const idleCls = "border-white/10 bg-zinc-900/50 text-zinc-400 hover:border-white/20 hover:bg-zinc-900 hover:text-white";
    const selectedCls = "border-[#B7FF00] bg-[#B7FF00]/5 text-[#B7FF00] shadow-[0_0_15px_-5px_rgba(183,255,0,0.3)]";

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={disabled ? undefined : onClick}
            className={[base, disabled ? disabledCls : selected ? selectedCls : idleCls].join(" ")}
            aria-pressed={selected ? "true" : "false"}
        >
            {icon && <div className={`flex-shrink-0 transition-colors ${selected ? "text-[#B7FF00]" : "text-white/40 group-hover:text-white"}`}>{icon}</div>}
            <div className="min-w-0">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${selected ? "text-[#B7FF00]" : "text-white group-hover:text-white"}`}>{label}</div>
                {description && <div className={`text-[9px] mt-0.5 truncate ${selected ? "text-[#B7FF00]/70" : "text-white/30 group-hover:text-white/50"}`}>{description}</div>}
            </div>
        </button>
    );
}
