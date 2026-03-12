"use client";

interface ChipSelectorProps {
    options: string[];
    selected?: string;
    onSelect: (option: string) => void;
    disabled?: boolean;
    multi?: boolean;
}

export default function ChipSelector({
    options,
    selected,
    onSelect,
    disabled,
}: ChipSelectorProps) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {options.map((option) => {
                const isSelected = selected === option;
                return (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onSelect(option)}
                        disabled={disabled}
                        className={[
                            "px-4 py-3 rounded-lg text-sm font-medium transition-all text-left",
                            isSelected
                                ? "bg-lime-400/10 border-lime-400 text-lime-400 border-2"
                                : "bg-[#111]/50 border-white/10 text-white/80 hover:border-white/20 hover:bg-[#111] border",
                            disabled && "opacity-50 cursor-not-allowed",
                        ].join(" ")}
                    >
                        {option}
                    </button>
                );
            })}
        </div>
    );
}
