"use client";

import { useNle, TimelineClip, TimelineTrack } from "../_context/NleContext";
import { Rnd } from "react-rnd";
import { Eye, EyeOff, Volume2, VolumeX, Trash2, Plus, Copy, ChevronRight, ChevronLeft, Settings2 } from "lucide-react";
import { useEffect, useRef, useCallback, useState } from "react";

// Add global styles for hiding scrollbars but keeping functionality
const HideScrollbarStyles = () => (
    <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar-none::-webkit-scrollbar { display: none; }
        .custom-scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
    `}} />
);

export default function NleTimeline({ isFullscreen = false }: { isFullscreen?: boolean }) {
    const { tracks, duration, zoomLevel, playhead, setPlayhead, isPlaying, setIsPlaying, duplicateTrack, toggleTrackMute, toggleTrackVisibility, activeTrackId, setActiveTrackId, setTrackVolume, playheadRef } = useNle();
    const [isControlsExpanded, setIsControlsExpanded] = useState(false);

    // DOM refs for direct manipulation during playback
    const rulerPlayheadRef = useRef<HTMLDivElement>(null);
    const trackPlayheadRef = useRef<HTMLDivElement>(null);
    const rulerContainerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | undefined>(undefined);

    // High-performance playhead line update via rAF (reads shared playheadRef)
    useEffect(() => {
        const updatePlayheadLine = () => {
            const pos = `${playheadRef.current * zoomLevel}px`;
            if (rulerPlayheadRef.current) rulerPlayheadRef.current.style.left = pos;
            if (trackPlayheadRef.current) trackPlayheadRef.current.style.left = pos;
            rafRef.current = requestAnimationFrame(updatePlayheadLine);
        };

        rafRef.current = requestAnimationFrame(updatePlayheadLine);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [zoomLevel, playheadRef]);

    // === Touch & Click Scrubbing (Mobile-First) ===
    const scrubFromPosition = useCallback((clientX: number) => {
        if (!rulerContainerRef.current) return;
        const rect = rulerContainerRef.current.getBoundingClientRect();
        const x = clientX - rect.left + rulerContainerRef.current.scrollLeft;
        const newTime = Math.max(0, Math.min(x / zoomLevel, duration));
        playheadRef.current = newTime;
        setPlayhead(newTime);
    }, [zoomLevel, duration, setPlayhead, playheadRef]);

    // Touch handlers for ruler scrubbing
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        if (isPlaying) setIsPlaying(false);
        scrubFromPosition(e.touches[0].clientX);
    }, [isPlaying, setIsPlaying, scrubFromPosition]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        scrubFromPosition(e.touches[0].clientX);
    }, [scrubFromPosition]);

    const handleClick = useCallback((e: React.MouseEvent) => {
        scrubFromPosition(e.clientX);
    }, [scrubFromPosition]);

    // Mouse drag scrubbing
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isPlaying) setIsPlaying(false);
        scrubFromPosition(e.clientX);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            scrubFromPosition(moveEvent.clientX);
        };
        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [isPlaying, setIsPlaying, scrubFromPosition]);

    return (
        <div className={`flex flex-col border-t border-white/5 relative z-10 ${isFullscreen ? "flex-1 h-full bg-[#0A0A0A]" : "h-72 bg-[#121212] shrink-0"}`}>
            <HideScrollbarStyles />

            {/* Top Ruler / Playhead Controls */}
            <div className="h-8 border-b border-white/5 bg-[#1A1A1A] flex items-center relative">
                {/* Left spacer for track headers */}
                <div className={`${isControlsExpanded ? "w-48 lg:w-64" : "w-12 lg:w-64"} h-full shrink-0 border-r border-white/5 bg-[#1F1F1F] flex items-center justify-between px-3 shadow-xl z-20 transition-all duration-300`}>
                    <span className={`text-[10px] text-white/30 font-mono tracking-widest uppercase truncate ${!isControlsExpanded && 'hidden lg:block'}`}>Timeline</span>
                    <button
                        onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                        className="lg:hidden w-6 h-6 rounded bg-white/5 flex items-center justify-center text-white/40 hover:text-white"
                    >
                        {isControlsExpanded ? <ChevronLeft size={14} /> : <Settings2 size={14} />}
                    </button>
                </div>

                {/* Playhead Ruler (Scrubable via touch + click + drag) */}
                <div
                    ref={rulerContainerRef}
                    className="flex-1 h-full relative cursor-text touch-none bg-[length:50px_100%] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGgwLjV2NDBIMHptMTAgMjVoMC41djE1SDEwem0xMCAwaDAuNXYxNUgyMHptMTAgMGgwLjV2MTVIMzB6bTEwIDBoMC41djE1SDQweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] overflow-x-auto overflow-y-hidden custom-scrollbar-none"
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    style={{ overflowX: 'auto' }}
                >
                    {/* Width of content to enable scrolling */}
                    <div style={{ width: `${duration * zoomLevel}px`, height: '100%', position: 'relative' }}>
                        {/* Playhead Line Indicator inside ruler (DOM-driven) */}
                        <div
                            ref={rulerPlayheadRef}
                            className="absolute top-0 bottom-0 w-[11px] -ml-[5px] z-50 flex justify-center pointer-events-none"
                            style={{ left: `${playhead * zoomLevel}px` }}
                        >
                            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-red-500 mt-0" />
                            <div className="absolute top-[6px] bottom-0 w-[1px] bg-red-500" />
                        </div>

                        {/* Time markers every 1 second */}
                        {Array.from({ length: duration }).map((_, i) => (
                            <span
                                key={i}
                                className="absolute text-[9px] text-white/30 font-mono top-1 pointer-events-none select-none"
                                style={{ left: `${i * zoomLevel + 2}px` }}
                            >
                                00:{(i).toString().padStart(2, '0')}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tracks Area */}
            <div className="flex-1 overflow-y-auto relative flex bg-[#0A0A0A]">

                {/* Track Headers (Fixed left) */}
                <div className={`${isControlsExpanded ? "w-48 lg:w-64" : "w-12 lg:w-64"} border-r border-white/5 bg-[#1A1A1A] flex flex-col shrink-0 z-20 shadow-xl relative transition-all duration-300 ${isFullscreen ? "bg-[#111]" : ""}`}>
                    {tracks.map(t => (
                        <TrackHeader
                            key={t.id}
                            track={t}
                            isActive={activeTrackId === t.id}
                            isExpanded={isControlsExpanded}
                            onAddClick={() => setActiveTrackId(t.id)}
                            onDuplicate={() => duplicateTrack(t.id)}
                            onToggleMute={() => toggleTrackMute(t.id)}
                            onToggleVisibility={() => toggleTrackVisibility(t.id)}
                            onVolumeChange={(val) => setTrackVolume(t.id, val)}
                        />
                    ))}
                </div>

                {/* Track Spans (Scrollable Right) */}
                <div
                    className="flex-1 relative overflow-x-auto overflow-y-hidden custom-scrollbar-none min-w-0"
                    onScroll={(e) => {
                        if (rulerContainerRef.current) {
                            rulerContainerRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
                        }
                    }}
                >
                    <div style={{ width: `${duration * zoomLevel}px`, position: 'relative', minHeight: '100%' }}>
                        {/* Vertical Playhead Line across all tracks (DOM-driven) */}
                        <div
                            ref={trackPlayheadRef}
                            className="absolute top-0 bottom-0 w-[1px] bg-red-500/80 z-40 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                            style={{ left: `${playhead * zoomLevel}px` }}
                        />

                        {/* Render Track Rows */}
                        {tracks.map(t => <TrackRow key={t.id} track={t} isFullscreen={isFullscreen} />)}
                    </div>
                </div>

            </div>
        </div>
    );
}

// Subcomponents

interface TrackHeaderProps {
    track: TimelineTrack;
    isActive: boolean;
    isExpanded: boolean;
    onAddClick: () => void;
    onDuplicate: () => void;
    onToggleMute: () => void;
    onToggleVisibility: () => void;
    onVolumeChange: (val: number) => void;
}

function TrackHeader({ track, isActive, isExpanded, onAddClick, onDuplicate, onToggleMute, onToggleVisibility, onVolumeChange }: TrackHeaderProps) {
    return (
        <div className={`h-16 border-b border-white/5 flex items-center px-3 transition-all duration-300 gap-2 group shrink-0 relative ${isActive ? "bg-[#181818] border-l-2 border-l-lime-500" : "bg-[#111] hover:bg-[#1A1A1A]"}`}>
            {/* Track Name */}
            <div className={`flex flex-col min-w-0 shrink-0 ${!isExpanded && "lg:flex hidden"}`}>
                <span className={`text-[10px] lg:text-xs font-bold truncate ${isActive ? "text-lime-400" : "text-white/80"}`}>
                    {track.name}
                </span>
                <span className="text-[8px] lg:text-[10px] text-white/30 uppercase">TRACK</span>
            </div>

            {/* Collapsed view indicator (Only on mobile when not expanded) */}
            {!isExpanded && (
                <div className="lg:hidden flex-1 flex items-center justify-center">
                    <div className={`w-1 h-8 rounded-full ${isActive ? 'bg-lime-500' : 'bg-white/10'}`} />
                </div>
            )}

            {/* Volume Slider */}
            <div className={`flex items-center gap-1.5 flex-1 min-w-0 px-1 ${(isExpanded || 'lg:flex hidden') ? 'flex' : 'hidden'}`}>
                <button onClick={onToggleMute} title={track.muted ? "Unmute" : "Mute"} className="w-5 h-5 rounded flex items-center justify-center text-white/50 hover:text-white transition shrink-0">
                    {track.muted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
                </button>
                <input
                    type="range"
                    min="0" max="1" step="0.01"
                    value={track.muted ? 0 : track.volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="flex-1 h-1 min-w-0 bg-white/10 rounded-full appearance-none cursor-pointer accent-lime-500"
                    style={{ accentColor: track.muted ? '#ef4444' : '#6366f1' }}
                />
                <span className="text-[9px] font-mono text-white/30 w-6 text-right shrink-0">
                    {track.muted ? '0' : Math.round(track.volume * 100)}
                </span>
            </div>

            {/* Action Buttons */}
            <div className={`items-center gap-1 shrink-0 ${(isExpanded || 'lg:flex hidden') ? 'flex' : 'hidden'}`}>
                <button onClick={onDuplicate} title="Duplicate Track" className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition">
                    <Copy size={10} />
                </button>
                <button onClick={onToggleVisibility} title={track.visible ? "Hide" : "Show"} className="w-5 h-5 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition">
                    {track.visible ? <Eye size={10} /> : <EyeOff size={10} className="text-red-400" />}
                </button>
                <button onClick={onAddClick} title="Set Active Track" className="w-5 h-5 rounded bg-lime-500/20 hover:bg-lime-500 flex items-center justify-center text-lime-400 hover:text-black transition">
                    <Plus size={12} />
                </button>
            </div>
        </div>
    );
}

function TrackRow({ track, isFullscreen }: { track: TimelineTrack, isFullscreen: boolean }) {
    const { zoomLevel } = useNle();

    return (
        <div
            className={`${isFullscreen ? "flex-1 min-h-[64px]" : "h-16"} border-b border-white/5 relative bg-[length:50px_100%] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI2NCI+PHBhdGggZD0iTTAgMEgwLjVWNjRIMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMSkiLz48L3N2Zz4=')] bg-repeat-x`}
        >
            {track.clips.map(c => (
                <ClipBlock key={c.id} clip={c} trackId={track.id} />
            ))}
        </div>
    );
}

function ClipBlock({ clip, trackId }: { clip: TimelineClip, trackId: string }) {
    const { zoomLevel, updateClip, removeClip, selectedClipId, setSelectedClipId } = useNle();
    const isSelected = selectedClipId === clip.id;

    // Pixel math
    const duration = clip.outPoint - clip.inPoint;
    const width = duration * zoomLevel;
    const left = clip.startTime * zoomLevel;

    // Colors
    let bColor = "border-lime-500/30";
    let bgGradient = "from-lime-500/20 to-lime-500/5";
    let iconColor = "text-lime-400";

    if (clip.mediaType === 'video') {
        bColor = "border-amber-500/30"; bgGradient = "from-amber-500/20 to-amber-500/5"; iconColor = "text-amber-400";
    } else if (clip.mediaType === 'voice') {
        bColor = "border-teal-500/30"; bgGradient = "from-teal-500/20 to-teal-500/5"; iconColor = "text-teal-400";
    } else if (clip.mediaType === 'music') {
        bColor = "border-pink-500/30"; bgGradient = "from-pink-500/20 to-pink-500/5"; iconColor = "text-pink-400";
    }

    return (
        <Rnd
            bounds="parent"
            size={{ width, height: 48 }}
            position={{ x: left, y: 8 }} // 8px padding top
            enableResizing={{ left: true, right: true, top: false, bottom: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }}
            dragAxis="x"
            onDragStop={(e, d) => {
                // Update start time based on new X
                const newStartTime = Math.max(0, d.x / zoomLevel);
                updateClip(trackId, clip.id, { startTime: newStartTime });
            }}
            onResizeStop={(e, direction, ref, delta, position) => {
                // Determine new duration and in/out points based on resize handled by react-rnd
                const newWidth = parseInt(ref.style.width, 10);
                const newDuration = newWidth / zoomLevel;
                const newStartTime = Math.max(0, position.x / zoomLevel);

                if (direction === 'left') {
                    // Trimming the front changes startTime and inPoint
                    const diff = newStartTime - clip.startTime;
                    updateClip(trackId, clip.id, {
                        startTime: newStartTime,
                        inPoint: Math.max(0, clip.inPoint + diff)
                    });
                } else {
                    // Trimming the back just changes outPoint
                    updateClip(trackId, clip.id, {
                        outPoint: clip.inPoint + newDuration
                    });
                }
            }}
            onClick={(e: any) => { e.stopPropagation(); setSelectedClipId(clip.id); }}
            className={`
                group absolute rounded-lg border shadow-sm flex flex-col overflow-hidden transition-shadow cursor-grab active:cursor-grabbing
                bg-gradient-to-r ${bgGradient} backdrop-blur-md
                ${isSelected ? `ring-2 ring-white/80 ${bColor} z-20` : `${bColor} z-10 hover:border-white/40 hover:z-20`}
            `}
        >
            <div className={`h-1.5 w-full bg-black/20`} />
            <div className="px-2 py-1 flex-1 flex flex-col justify-center min-w-0 pointer-events-none">
                <span className={`text-[10px] font-bold truncate ${iconColor} drop-shadow-md`}>
                    {clip.mediaType.toUpperCase()}
                </span>
                <span className="text-[9px] text-white/50 font-mono">
                    {duration.toFixed(1)}s
                </span>
            </div>

            {/* Delete button (only show if selected) */}
            {isSelected && (
                <button
                    onClick={(e) => { e.stopPropagation(); removeClip(trackId, clip.id); }}
                    className="absolute right-1 top-1 w-5 h-5 bg-red-500 hover:bg-red-400 rounded flex items-center justify-center text-white shadow-md pointer-events-auto transition"
                >
                    <Trash2 size={10} />
                </button>
            )}

            {/* Left/Right Drag Handles */}
            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 transition group-hover:bg-white/10" />
            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/20 transition group-hover:bg-white/10" />
        </Rnd>
    );
}
