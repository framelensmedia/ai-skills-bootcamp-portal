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
    const disabledCls = "cursor-not-allowed border-border/50 bg-secondary/50 text-muted-foreground/50";
    const idleCls = "border-border bg-card text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground";
    const selectedCls = "border-primary bg-primary/10 text-primary shadow-sm";

    return (
        <button
            type="button"
            disabled={disabled}
            onClick={disabled ? undefined : onClick}
            className={[base, disabled ? disabledCls : selected ? selectedCls : idleCls].join(" ")}
            aria-pressed={selected ? "true" : "false"}
        >
            {icon && <div className={`flex-shrink-0 transition-colors ${selected ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>{icon}</div>}
            <div className="min-w-0">
                <div className={`text-[10px] font-bold uppercase tracking-wider ${selected ? "text-primary" : "text-foreground group-hover:text-foreground"}`}>{label}</div>
                {description && <div className={`text-[9px] mt-0.5 truncate ${selected ? "text-primary/70" : "text-muted-foreground group-hover:text-muted-foreground"}`}>{description}</div>}
            </div>
        </button>
    );
}
