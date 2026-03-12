"use client";

import { useEffect, useRef } from "react";
import { useNle } from "../_context/NleContext";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

export default function NleTransportBar() {
    const { playhead, setPlayhead, isPlaying, setIsPlaying, duration, playheadRef } = useNle();

    // DOM ref for direct timecode updates
    const timecodeRef = useRef<HTMLSpanElement>(null);
    const rafRef = useRef<number | undefined>(undefined);

    // Format Time Helper
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // High-performance timecode update via rAF (reads shared playheadRef)
    useEffect(() => {
        const updateTimecode = () => {
            if (timecodeRef.current) {
                timecodeRef.current.textContent = formatTime(playheadRef.current);
            }
            rafRef.current = requestAnimationFrame(updateTimecode);
        };

        rafRef.current = requestAnimationFrame(updateTimecode);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [playheadRef]);

    return (
        <div className="h-16 shrink-0 bg-[#0A0A0A] border-t border-white/10 flex items-center justify-between px-6 z-50">
            {/* Empty Left Placeholder */}
            <div className="flex-1 flex items-center justify-start" />

            {/* Center Controls */}
            <div className="flex items-center gap-6">
                <button
                    onClick={() => { setPlayhead(0); playheadRef.current = 0; setIsPlaying(false); }}
                    className="text-white/50 hover:text-white transition"
                    title="Jump to Start"
                >
                    <SkipBack size={20} className="fill-current" />
                </button>

                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 bg-lime-500 hover:bg-lime-400 text-black rounded-full flex items-center justify-center transition-all shadow-lg shadow-lime-500/20"
                >
                    {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
                </button>

                <button
                    onClick={() => { setPlayhead(duration); playheadRef.current = duration; setIsPlaying(false); }}
                    className="text-white/50 hover:text-white transition"
                    title="Jump to End"
                >
                    <SkipForward size={20} className="fill-current" />
                </button>
            </div>

            {/* Right Side: Timecode */}
            <div className="flex-1 flex items-center justify-end">
                <span className="font-mono text-[11px] md:text-xs text-white/40 tracking-wider bg-[#111] px-3 py-1.5 rounded-lg border border-white/5">
                    <span ref={timecodeRef} className="text-white font-bold">{formatTime(playhead)}</span> / {formatTime(duration)}
                </span>
            </div>
        </div>
    );
}
