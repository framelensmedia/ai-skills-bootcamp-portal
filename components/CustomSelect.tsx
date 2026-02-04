"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

type Option = {
    label: string;
    value: string;
};

type CustomSelectProps = {
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    className?: string; // wrapper class
};

export default function CustomSelect({ value, options, onChange, className }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find((o) => o.value === value)?.label || value;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-12 w-full items-center justify-between rounded-xl border border-white/5 bg-white/5 pl-4 pr-12 text-sm font-medium text-white transition-colors hover:bg-white/10 focus:border-white/20 outline-none"
            >
                <span className="truncate">{selectedLabel}</span>
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                    <ChevronDown className={`h-4 w-4 text-white/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute left-0 top-full mt-2 z-50 w-full min-w-[200px] overflow-hidden rounded-xl border border-white/10 bg-[#121212] shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-[60vh] overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors ${option.value === value
                                        ? "bg-white/10 text-white font-medium"
                                        : "text-white/70 hover:bg-white/5 hover:text-white"
                                    }`}
                            >
                                <span className="truncate mr-2">{option.label}</span>
                                {option.value === value && <Check className="h-4 w-4 text-[#B7FF00]" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
