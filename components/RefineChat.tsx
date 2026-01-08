import React, { useState } from 'react';

interface RefineChatProps {
    onRefine: (prompt: string) => void;
    isGenerating: boolean;
}

const suggestions = [
    { label: 'Change clothing', prompt: 'Change my clothing to something more formal' },
    { label: 'Change background', prompt: 'Change the background to a professional studio' },
    { label: 'Adjust lighting', prompt: 'Improve the lighting to be more cinematic' },
];

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
    );
}

function SendIcon({ size }: { size: number }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    );
}

export function RefineChat({ onRefine, isGenerating }: RefineChatProps) {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isGenerating) {
            onRefine(input.trim());
            setInput('');
        }
    };

    return (
        <div className="mt-4 flex flex-col gap-3 p-4 border border-white/10 rounded-2xl bg-black/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 text-lime-400 text-[10px] font-bold uppercase tracking-widest">
                <SparklesIcon className="animate-pulse" />
                <span>Refine Creation</span>
            </div>

            <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                    <button
                        key={s.label}
                        onClick={() => onRefine(s.prompt)}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-white/10 rounded-full bg-white/5 hover:bg-white/10 hover:border-lime-400/30 transition-all disabled:opacity-50 text-white/70"
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="relative mt-1">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask for changes (e.g., 'Make it look like sunset')"
                    disabled={isGenerating}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-lime-400/50"
                />
                <button
                    type="submit"
                    disabled={isGenerating || !input.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-lime-400 hover:text-lime-300 disabled:text-white/20 transition-colors"
                >
                    {isGenerating ? (
                        <div className="w-5 h-5 border-2 border-lime-400/20 border-t-lime-400 rounded-full animate-spin" />
                    ) : (
                        <SendIcon size={18} />
                    )}
                </button>
            </form>
            <p className="text-[9px] text-white/20 text-center uppercase tracking-tighter">Uses current image as reference</p>
        </div>
    );
}
