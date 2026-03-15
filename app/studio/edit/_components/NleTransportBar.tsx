"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useNle } from "../_context/NleContext";
import { Play, Pause, SkipBack, SkipForward, Scissors, MousePointer, Repeat, Undo2, Redo2 } from "lucide-react";

export default function NleTransportBar() {
    const {
        playhead, setPlayhead, isPlaying, setIsPlaying,
        duration, playheadRef,
        activeTool, setActiveTool,
        isLooping, setIsLooping,
        canUndo, canRedo, undo, redo,
    } = useNle();

    // DOM ref for direct timecode updates (bypasses React re-renders)
    const timecodeRef = useRef<HTMLSpanElement>(null);
    const rafRef      = useRef<number | undefined>(undefined);

    const formatTime = (seconds: number) => {
        const m  = Math.floor(seconds / 60);
        const s  = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    // High-performance timecode via rAF
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

    // Keyboard shortcuts
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't fire on input/textarea focus
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea') return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                setIsPlaying(prev => !prev);
                break;
            case 'KeyZ':
                if (e.metaKey || e.ctrlKey) {
                    e.preventDefault();
                    if (e.shiftKey) { redo(); } else { undo(); }
                }
                break;
            case 'KeyY':
                if (e.metaKey || e.ctrlKey) { e.preventDefault(); redo(); }
                break;
            case 'KeyJ':
                e.preventDefault();
                setIsPlaying(false);
                setPlayhead(0);
                playheadRef.current = 0;
                break;
            case 'KeyL':
                e.preventDefault();
                setIsPlaying(false);
                setPlayhead(duration);
                playheadRef.current = duration;
                break;
            case 'Comma':
                e.preventDefault();
                setIsPlaying(false);
                setPlayhead(prev => {
                    const t = Math.max(0, prev - 1 / 30);
                    playheadRef.current = t;
                    return t;
                });
                break;
            case 'Period':
                e.preventDefault();
                setIsPlaying(false);
                setPlayhead(prev => {
                    const t = Math.min(duration, prev + 1 / 30);
                    playheadRef.current = t;
                    return t;
                });
                break;
            case 'Escape':
                setActiveTool('select');
                break;
            case 'KeyC':
                if (!e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    setActiveTool(activeTool === 'razor' ? 'select' : 'razor');
                }
                break;
        }
    }, [setIsPlaying, setPlayhead, playheadRef, duration, setActiveTool]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    return (
        <div className="h-16 shrink-0 bg-[#0A0A0A] border-t border-white/10 flex items-center justify-between px-4 md:px-6 z-50 gap-2">

            {/* Left: Undo/Redo + Tool Toggles */}
            <div className="flex items-center gap-1.5 flex-1 justify-start">
                {/* Undo */}
                <button
                    onClick={undo}
                    disabled={!canUndo}
                    title="Undo (⌘Z)"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all border bg-white/5 border-white/10 disabled:opacity-25 enabled:hover:bg-white/10 enabled:hover:text-white text-white/50"
                >
                    <Undo2 size={14} />
                </button>

                {/* Redo */}
                <button
                    onClick={redo}
                    disabled={!canRedo}
                    title="Redo (⌘⇧Z)"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all border bg-white/5 border-white/10 disabled:opacity-25 enabled:hover:bg-white/10 enabled:hover:text-white text-white/50"
                >
                    <Redo2 size={14} />
                </button>

                <div className="w-px h-5 bg-white/10 mx-1" />

                {/* Select Tool */}
                <button
                    onClick={() => setActiveTool('select')}
                    title="Select Tool (Esc)"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold border ${
                        activeTool === 'select'
                            ? 'bg-white/15 border-white/30 text-white shadow-sm'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <MousePointer size={14} />
                </button>

                {/* Razor Tool */}
                <button
                    onClick={() => setActiveTool(activeTool === 'razor' ? 'select' : 'razor')}
                    title="Razor / Cut Tool (C)"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs font-bold border ${
                        activeTool === 'razor'
                            ? 'bg-red-500/20 border-red-500/60 text-red-400 shadow-sm shadow-red-500/10'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <Scissors size={14} />
                </button>

                {/* Keyboard hint */}
                <span className="hidden md:block text-[9px] text-white/20 font-mono ml-1 leading-tight">
                    ⌘Z undo<br/>C razor
                </span>
            </div>

            {/* Center: Transport */}
            <div className="flex items-center gap-4 md:gap-6">
                <button
                    onClick={() => { setPlayhead(0); playheadRef.current = 0; setIsPlaying(false); }}
                    className="text-white/50 hover:text-white transition"
                    title="Jump to Start (J)"
                >
                    <SkipBack size={20} className="fill-current" />
                </button>

                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 bg-lime-500 hover:bg-lime-400 text-black rounded-full flex items-center justify-center transition-all shadow-lg shadow-lime-500/20 active:scale-95"
                >
                    {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-0.5" />}
                </button>

                <button
                    onClick={() => { setPlayhead(duration); playheadRef.current = duration; setIsPlaying(false); }}
                    className="text-white/50 hover:text-white transition"
                    title="Jump to End (L)"
                >
                    <SkipForward size={20} className="fill-current" />
                </button>
            </div>

            {/* Right: Loop + Timecode */}
            <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end">
                {/* Loop Toggle */}
                <button
                    onClick={() => setIsLooping(!isLooping)}
                    title="Loop Playback"
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all border ${
                        isLooping
                            ? 'bg-lime-500/20 border-lime-500/50 text-lime-400'
                            : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <Repeat size={14} />
                </button>

                {/* Timecode */}
                <span className="font-mono text-[10px] md:text-xs text-white/40 tracking-wider bg-[#111] px-2 md:px-3 py-1.5 rounded-lg border border-white/5 whitespace-nowrap">
                    <span ref={timecodeRef} className="text-white font-bold">{formatTime(playhead)}</span>
                    <span className="hidden md:inline"> / {formatTime(duration)}</span>
                </span>
            </div>
        </div>
    );
}
