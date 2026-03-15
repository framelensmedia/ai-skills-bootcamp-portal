"use client";

import { useNle, TimelineClip, TimelineTrack, ActiveTool } from "../_context/NleContext";
import { Eye, EyeOff, Volume2, VolumeX, Trash2, Plus, Copy, ChevronLeft, Settings2 } from "lucide-react";
import { useEffect, useRef, useCallback, useState, useLayoutEffect } from "react";

// ─── Global scrollbar hide ───
const HideScrollbarStyles = () => (
    <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar-none::-webkit-scrollbar { display: none; }
        .custom-scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        .clip-body { cursor: grab; }
        .clip-body:active { cursor: grabbing; }
    `}} />
);

// ─── Audio waveform cache ───
// Keyed by URL → Float32Array of normalised peak amplitudes
const waveformCache = new Map<string, Float32Array>();
const AC = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

async function getWaveformData(url: string, buckets: number): Promise<Float32Array> {
    const cached = waveformCache.get(url + ':' + buckets);
    if (cached) return cached;

    try {
        const res  = await fetch(url);
        const buf  = await res.arrayBuffer();
        const decoded = await AC!.decodeAudioData(buf);
        const raw  = decoded.getChannelData(0);
        const step = Math.floor(raw.length / buckets);
        const peaks = new Float32Array(buckets);
        for (let i = 0; i < buckets; i++) {
            let max = 0;
            const start = i * step;
            for (let j = start; j < start + step; j++) {
                const v = Math.abs(raw[j]);
                if (v > max) max = v;
            }
            peaks[i] = max;
        }
        waveformCache.set(url + ':' + buckets, peaks);
        return peaks;
    } catch {
        const flat = new Float32Array(buckets).fill(0.3);
        waveformCache.set(url + ':' + buckets, flat);
        return flat;
    }
}

// ─── Video thumbnail cache ───
const thumbCache = new Map<string, string>(); // url → data-URL

async function getVideoThumb(url: string): Promise<string> {
    const cached = thumbCache.get(url);
    if (cached) return cached;

    return new Promise(resolve => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.muted = true;
        video.onloadedmetadata = () => { video.currentTime = Math.min(0.5, video.duration * 0.1); };
        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width  = 160;
            canvas.height = 90;
            canvas.getContext('2d')!.drawImage(video, 0, 0, 160, 90);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            thumbCache.set(url, dataUrl);
            resolve(dataUrl);
        };
        video.onerror = () => resolve('');
        video.src = url;
    });
}

// ─── Main Timeline ───────────────────────────────────────────────────────────

export default function NleTimeline({ isFullscreen = false }: { isFullscreen?: boolean }) {
    const {
        tracks, duration, zoomLevel, playhead, setPlayhead, isPlaying, setIsPlaying,
        duplicateTrack, toggleTrackMute, toggleTrackVisibility, activeTrackId, setActiveTrackId,
        setTrackVolume, playheadRef, activeTool, splitClip, removeTrack,
    } = useNle();
    const [isControlsExpanded, setIsControlsExpanded] = useState(false);

    // DOM refs for DOM-driven playhead (no React re-renders per frame)
    const rulerPlayheadRef  = useRef<HTMLDivElement>(null);
    const trackPlayheadRef  = useRef<HTMLDivElement>(null);
    const rulerContainerRef = useRef<HTMLDivElement>(null);
    const tracksScrollRef   = useRef<HTMLDivElement>(null);
    const rafRef            = useRef<number | undefined>(undefined);

    // ── High-perf playhead line + auto-scroll ──
    useEffect(() => {
        let lastScrollPos = -1;

        const update = () => {
            const pos = playheadRef.current * zoomLevel;
            const posStr = `${pos}px`;

            if (rulerPlayheadRef.current) rulerPlayheadRef.current.style.left = posStr;
            if (trackPlayheadRef.current) trackPlayheadRef.current.style.left = posStr;

            // Auto-scroll during playback
            if (isPlaying && tracksScrollRef.current) {
                const container = tracksScrollRef.current;
                const cw        = container.clientWidth;
                const scroll    = container.scrollLeft;
                const margin    = cw * 0.15; // keep playhead in the middle 70%

                if (pos < scroll + margin || pos > scroll + cw - margin) {
                    const target = pos - cw * 0.4;
                    if (Math.abs(target - lastScrollPos) > 2) {
                        container.scrollLeft = Math.max(0, target);
                        lastScrollPos = target;
                        if (rulerContainerRef.current) rulerContainerRef.current.scrollLeft = container.scrollLeft;
                    }
                }
            }

            rafRef.current = requestAnimationFrame(update);
        };

        rafRef.current = requestAnimationFrame(update);
        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [zoomLevel, playheadRef, isPlaying]);

    // ── Ruler scrubbing ──
    const scrubFromPosition = useCallback((clientX: number) => {
        if (!rulerContainerRef.current) return;
        const rect = rulerContainerRef.current.getBoundingClientRect();
        const x    = clientX - rect.left + rulerContainerRef.current.scrollLeft;
        const t    = Math.max(0, Math.min(x / zoomLevel, duration));
        playheadRef.current = t;
        setPlayhead(t);
    }, [zoomLevel, duration, setPlayhead, playheadRef]);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        if (isPlaying) setIsPlaying(false);
        scrubFromPosition(e.touches[0].clientX);
    }, [isPlaying, setIsPlaying, scrubFromPosition]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        e.preventDefault();
        scrubFromPosition(e.touches[0].clientX);
    }, [scrubFromPosition]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (isPlaying) setIsPlaying(false);
        scrubFromPosition(e.clientX);
        const onMove = (ev: MouseEvent) => scrubFromPosition(ev.clientX);
        const onUp   = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [isPlaying, setIsPlaying, scrubFromPosition]);

    // Sync ruler scroll with track scroll
    const handleTracksScroll = useCallback((e: React.UIEvent) => {
        if (rulerContainerRef.current) {
            rulerContainerRef.current.scrollLeft = (e.currentTarget as HTMLDivElement).scrollLeft;
        }
    }, []);

    return (
        <div className={`flex flex-col border-t border-white/5 relative z-10 ${isFullscreen ? "flex-1 h-full bg-[#0A0A0A]" : "h-72 bg-[#121212] shrink-0"}`}>
            <HideScrollbarStyles />

            {/* ── Ruler ── */}
            <div className="h-8 border-b border-white/5 bg-[#1A1A1A] flex items-center relative">
                {/* Track header spacer */}
                <div className={`${isControlsExpanded ? "w-48 lg:w-64" : "w-12 lg:w-64"} h-full shrink-0 border-r border-white/5 bg-[#1F1F1F] flex items-center justify-between px-3 shadow-xl z-20 transition-all duration-300`}>
                    <span className={`text-[10px] text-white/30 font-mono tracking-widest uppercase truncate ${!isControlsExpanded && 'hidden lg:block'}`}>Timeline</span>
                    <button
                        onClick={() => setIsControlsExpanded(!isControlsExpanded)}
                        className="lg:hidden w-6 h-6 rounded bg-white/5 flex items-center justify-center text-white/40 hover:text-white"
                    >
                        {isControlsExpanded ? <ChevronLeft size={14} /> : <Settings2 size={14} />}
                    </button>
                </div>

                {/* Scrubable ruler */}
                <div
                    ref={rulerContainerRef}
                    className="flex-1 h-full relative cursor-text touch-none overflow-x-hidden overflow-y-hidden custom-scrollbar-none"
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                >
                    <div style={{ width: `${duration * zoomLevel}px`, height: '100%', position: 'relative' }}>
                        {/* Playhead indicator */}
                        <div
                            ref={rulerPlayheadRef}
                            className="absolute top-0 bottom-0 w-[11px] -ml-[5px] z-50 flex justify-center pointer-events-none"
                            style={{ left: `${playhead * zoomLevel}px` }}
                        >
                            <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-red-500 mt-0" />
                            <div className="absolute top-[6px] bottom-0 w-[1px] bg-red-500" />
                        </div>
                        {/* Time markers */}
                        {Array.from({ length: duration }).map((_, i) => (
                            <span key={i} className="absolute text-[9px] text-white/30 font-mono top-1 pointer-events-none select-none" style={{ left: `${i * zoomLevel + 2}px` }}>
                                {`00:${i.toString().padStart(2, '0')}`}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Tracks area ── */}
            <div className="flex-1 overflow-y-auto relative flex bg-[#0A0A0A]">

                {/* Track headers */}
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
                            onDelete={() => removeTrack(t.id)}
                        />
                    ))}
                </div>

                {/* Track spans */}
                <div
                    ref={tracksScrollRef}
                    className="flex-1 relative overflow-x-auto overflow-y-hidden custom-scrollbar-none min-w-0"
                    onScroll={handleTracksScroll}
                >
                    <div style={{ width: `${duration * zoomLevel}px`, position: 'relative', minHeight: '100%' }}>
                        {/* Vertical playhead line */}
                        <div
                            ref={trackPlayheadRef}
                            className="absolute top-0 bottom-0 w-[1px] bg-red-500/80 z-40 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                            style={{ left: `${playhead * zoomLevel}px` }}
                        />
                        {/* Track rows */}
                        {tracks.map(t => (
                            <TrackRow
                                key={t.id}
                                track={t}
                                isFullscreen={isFullscreen}
                                activeTool={activeTool}
                                onSplit={splitClip}
                                zoomLevel={zoomLevel}
                                playheadRef={playheadRef}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Track Header ────────────────────────────────────────────────────────────

interface TrackHeaderProps {
    track: TimelineTrack;
    isActive: boolean;
    isExpanded: boolean;
    onAddClick: () => void;
    onDuplicate: () => void;
    onToggleMute: () => void;
    onToggleVisibility: () => void;
    onVolumeChange: (val: number) => void;
    onDelete: () => void;
}

function TrackHeader({ track, isActive, isExpanded, onAddClick, onDuplicate, onToggleMute, onToggleVisibility, onVolumeChange, onDelete }: TrackHeaderProps) {
    return (
        <div className={`h-16 border-b border-white/5 flex items-center px-3 transition-all duration-300 gap-2 group shrink-0 relative ${isActive ? "bg-[#181818] border-l-2 border-l-lime-500" : "bg-[#111] hover:bg-[#1A1A1A]"}`}>
            <div className={`flex flex-col min-w-0 shrink-0 ${!isExpanded && "lg:flex hidden"}`}>
                <span className={`text-[10px] lg:text-xs font-bold truncate ${isActive ? "text-lime-400" : "text-white/80"}`}>{track.name}</span>
                <span className="text-[8px] lg:text-[10px] text-white/30 uppercase">TRACK</span>
            </div>

            {!isExpanded && (
                <div className="lg:hidden flex-1 flex items-center justify-center">
                    <div className={`w-1 h-8 rounded-full ${isActive ? 'bg-lime-500' : 'bg-white/10'}`} />
                </div>
            )}

            <div className={`flex items-center gap-1.5 flex-1 min-w-0 px-1 ${(isExpanded || 'lg:flex hidden') ? 'flex' : 'hidden'}`}>
                <button onClick={onToggleMute} title={track.muted ? "Unmute" : "Mute"} className="w-5 h-5 rounded flex items-center justify-center text-white/50 hover:text-white transition shrink-0">
                    {track.muted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
                </button>
                <input
                    type="range" min="0" max="1" step="0.01"
                    value={track.muted ? 0 : track.volume}
                    onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                    className="flex-1 h-1 min-w-0 bg-white/10 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: track.muted ? '#ef4444' : '#a3e635' }}
                />
                <span className="text-[9px] font-mono text-white/30 w-6 text-right shrink-0">
                    {track.muted ? '0' : Math.round(track.volume * 100)}
                </span>
            </div>

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
                <button
                    onClick={onDelete}
                    title="Delete Track"
                    className="w-5 h-5 rounded bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-white/30 hover:text-red-400 transition"
                >
                    <Trash2 size={10} />
                </button>
            </div>
        </div>
    );
}

// ─── Track Row ───────────────────────────────────────────────────────────────

interface TrackRowProps {
    track: TimelineTrack;
    isFullscreen: boolean;
    activeTool: ActiveTool;
    onSplit: (trackId: string, clipId: string, splitTime: number) => void;
    zoomLevel: number;
    playheadRef: React.MutableRefObject<number>;
}

function TrackRow({ track, isFullscreen, activeTool, onSplit, zoomLevel, playheadRef }: TrackRowProps) {
    const [razorX, setRazorX] = useState<number | null>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (activeTool !== 'razor') return;
        if (!rowRef.current) return;
        const rect = rowRef.current.getBoundingClientRect();
        setRazorX(e.clientX - rect.left);
    }, [activeTool]);

    const handlePointerLeave = useCallback(() => setRazorX(null), []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (activeTool !== 'razor') return;
        if (!rowRef.current) return;
        e.preventDefault();
        const rect = rowRef.current.getBoundingClientRect();
        // Correct for track-row's own scroll offset by getting parent scroller
        const scroller = rowRef.current.closest('.custom-scrollbar-none') as HTMLElement | null;
        const scrollLeft = scroller?.scrollLeft ?? 0;
        const clickX = (e.clientX - rect.left) + scrollLeft;
        const clickTime = clickX / zoomLevel;

        // Find which clip we clicked
        for (const clip of track.clips) {
            const clipStart = clip.startTime;
            const clipEnd   = clip.startTime + (clip.outPoint - clip.inPoint);
            if (clickTime > clipStart && clickTime < clipEnd) {
                onSplit(track.id, clip.id, clickTime);
                break;
            }
        }
    }, [activeTool, track, zoomLevel, onSplit]);

    return (
        <div
            ref={rowRef}
            className={`${isFullscreen ? "flex-1 min-h-[64px]" : "h-16"} border-b border-white/5 relative ${activeTool === 'razor' ? 'cursor-crosshair' : ''}`}
            style={{
                backgroundImage: "url(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI2NCI+PHBhdGggZD0iTTAgMEgwLjVWNjRIMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMSkiLz48L3N2Zz4=\")",
                backgroundSize: `${zoomLevel}px 100%`,
                backgroundRepeat: 'repeat-x',
            }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
        >
            {/* Razor guide line */}
            {activeTool === 'razor' && razorX !== null && (
                <div
                    className="absolute top-0 bottom-0 w-[1px] bg-red-400/80 z-50 pointer-events-none"
                    style={{ left: razorX }}
                >
                    <div className="absolute top-0 left-[-4px] w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-red-400" />
                </div>
            )}

            {track.clips.map(c => (
                <ClipBlock key={c.id} clip={c} trackId={track.id} activeTool={activeTool} />
            ))}
        </div>
    );
}

// ─── Clip Block ──────────────────────────────────────────────────────────────

interface ClipBlockProps {
    clip: TimelineClip;
    trackId: string;
    activeTool: ActiveTool;
}

function ClipBlock({ clip, trackId, activeTool }: ClipBlockProps) {
    const { zoomLevel, updateClip, removeClip, selectedClipId, setSelectedClipId } = useNle();
    const isSelected = selectedClipId === clip.id;

    const clipDuration = clip.outPoint - clip.inPoint;
    const width  = clipDuration * zoomLevel;
    const left   = clip.startTime * zoomLevel;

    // Colours per type
    let borderColor = 'border-lime-500/40';
    let bgFrom      = 'from-lime-500/20';
    let bgTo        = 'to-lime-500/5';
    let accentColor = '#a3e635';
    let labelColor  = 'text-lime-400';

    if (clip.mediaType === 'video') {
        borderColor = 'border-amber-500/40'; bgFrom = 'from-amber-500/15'; bgTo = 'to-amber-500/5'; accentColor = '#f59e0b'; labelColor = 'text-amber-400';
    } else if (clip.mediaType === 'voice') {
        borderColor = 'border-teal-500/40';  bgFrom = 'from-teal-500/20';  bgTo = 'to-teal-500/5';  accentColor = '#2dd4bf'; labelColor = 'text-teal-400';
    } else if (clip.mediaType === 'music') {
        borderColor = 'border-pink-500/40';  bgFrom = 'from-pink-500/20';  bgTo = 'to-pink-500/5';  accentColor = '#f472b6'; labelColor = 'text-pink-400';
    } else if (clip.mediaType === 'audio') {
        borderColor = 'border-purple-500/40'; bgFrom = 'from-purple-500/20'; bgTo = 'to-purple-500/5'; accentColor = '#a78bfa'; labelColor = 'text-purple-400';
    }

    const isAudio = clip.mediaType === 'audio' || clip.mediaType === 'voice' || clip.mediaType === 'music';
    const isVideo = clip.mediaType === 'video';

    // ── Drag (move) ──
    const bodyRef  = useRef<HTMLDivElement>(null);
    const dragRef  = useRef<{ startX: number; startLeft: number } | null>(null);

    const handleBodyPointerDown = useCallback((e: React.PointerEvent) => {
        if (activeTool === 'razor') return;
        // Don't trigger on trim handles
        if ((e.target as HTMLElement).dataset.trimHandle) return;
        e.stopPropagation();
        e.preventDefault();
        if (!bodyRef.current) return;
        bodyRef.current.setPointerCapture(e.pointerId);
        dragRef.current = { startX: e.clientX, startLeft: left };
    }, [activeTool, left]);

    const handleBodyPointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragRef.current) return;
        const dx        = e.clientX - dragRef.current.startX;
        const newLeft   = Math.max(0, dragRef.current.startLeft + dx);
        const newStart  = newLeft / zoomLevel;
        updateClip(trackId, clip.id, { startTime: Math.round(newStart * 100) / 100 });
    }, [clip.id, trackId, updateClip, zoomLevel]);

    const handleBodyPointerUp = useCallback(() => { dragRef.current = null; }, []);

    // ── Left trim ──
    const leftTrimRef  = useRef<{ startX: number; startInPoint: number; startStartTime: number } | null>(null);

    const handleLeftPointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation(); e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        leftTrimRef.current = { startX: e.clientX, startInPoint: clip.inPoint, startStartTime: clip.startTime };
    }, [clip.inPoint, clip.startTime]);

    const handleLeftPointerMove = useCallback((e: React.PointerEvent) => {
        if (!leftTrimRef.current) return;
        const dx         = e.clientX - leftTrimRef.current.startX;
        const dtSeconds  = dx / zoomLevel;
        const maxDelta   = (clip.outPoint - clip.inPoint) - 0.1; // keep at least 0.1s
        const clampedDt  = Math.max(-leftTrimRef.current.startInPoint, Math.min(dtSeconds, maxDelta));
        updateClip(trackId, clip.id, {
            startTime: leftTrimRef.current.startStartTime + clampedDt,
            inPoint:   leftTrimRef.current.startInPoint   + clampedDt,
        });
    }, [clip.id, clip.inPoint, clip.outPoint, trackId, updateClip, zoomLevel]);

    const handleLeftPointerUp = useCallback(() => { leftTrimRef.current = null; }, []);

    // ── Right trim ──
    const rightTrimRef = useRef<{ startX: number; startOutPoint: number } | null>(null);

    const handleRightPointerDown = useCallback((e: React.PointerEvent) => {
        e.stopPropagation(); e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        rightTrimRef.current = { startX: e.clientX, startOutPoint: clip.outPoint };
    }, [clip.outPoint]);

    const handleRightPointerMove = useCallback((e: React.PointerEvent) => {
        if (!rightTrimRef.current) return;
        const dx        = e.clientX - rightTrimRef.current.startX;
        const dtSeconds = dx / zoomLevel;
        const minOut    = clip.inPoint + 0.1;
        const maxOut    = clip.inPoint + clip.duration;
        const newOut    = Math.max(minOut, Math.min(rightTrimRef.current.startOutPoint + dtSeconds, maxOut));
        updateClip(trackId, clip.id, { outPoint: newOut });
    }, [clip.id, clip.inPoint, clip.duration, trackId, updateClip, zoomLevel]);

    const handleRightPointerUp = useCallback(() => { rightTrimRef.current = null; }, []);

    return (
        <div
            ref={bodyRef}
            data-clip-id={clip.id}
            className={`
                clip-body absolute rounded-lg border shadow-sm flex flex-col overflow-hidden select-none
                bg-gradient-to-r ${bgFrom} ${bgTo} backdrop-blur-md
                ${isSelected ? `ring-2 ring-white/80 ${borderColor} z-20` : `${borderColor} z-10 hover:border-white/40 hover:z-20`}
                ${activeTool === 'razor' ? 'cursor-crosshair pointer-events-none' : ''}
            `}
            style={{ position: 'absolute', left, top: 8, width: Math.max(width, 20), height: 48 }}
            onPointerDown={handleBodyPointerDown}
            onPointerMove={handleBodyPointerMove}
            onPointerUp={handleBodyPointerUp}
            onClick={(e) => { e.stopPropagation(); if (activeTool === 'select') setSelectedClipId(clip.id); }}
        >
            {/* Coloured top strip */}
            <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor + '66' }} />

            {/* Content area */}
            <div className="flex-1 relative overflow-hidden">
                {isAudio  && <AudioWaveform url={clip.url} color={accentColor} />}
                {isVideo  && <VideoThumbnail url={clip.url} />}

                {/* Label overlay */}
                <div className="absolute inset-0 flex flex-col justify-center px-2 pointer-events-none mix-blend-normal">
                    <span className={`text-[9px] font-bold uppercase tracking-wide truncate drop-shadow-md ${labelColor}`}>
                        {clip.mediaType}
                    </span>
                    <span className="text-[8px] text-white/40 font-mono truncate">
                        {clipDuration.toFixed(1)}s
                    </span>
                </div>
            </div>

            {/* Delete button */}
            {isSelected && activeTool === 'select' && (
                <button
                    className="absolute right-1 top-1 w-5 h-5 bg-red-500 hover:bg-red-400 rounded flex items-center justify-center text-white shadow-md z-30 transition"
                    onPointerDown={(e) => { e.stopPropagation(); removeClip(trackId, clip.id); }}
                >
                    <Trash2 size={10} />
                </button>
            )}

            {/* Left trim handle — wide hit area */}
            <div
                data-trim-handle="left"
                className="absolute left-0 top-0 bottom-0 w-4 z-30 flex items-center justify-center group/trim"
                style={{ cursor: 'col-resize', touchAction: 'none' }}
                onPointerDown={handleLeftPointerDown}
                onPointerMove={handleLeftPointerMove}
                onPointerUp={handleLeftPointerUp}
            >
                <div className="w-[3px] h-6 rounded-full bg-white/20 group-hover/trim:bg-white/70 transition" />
            </div>

            {/* Right trim handle */}
            <div
                data-trim-handle="right"
                className="absolute right-0 top-0 bottom-0 w-4 z-30 flex items-center justify-center group/trim"
                style={{ cursor: 'col-resize', touchAction: 'none' }}
                onPointerDown={handleRightPointerDown}
                onPointerMove={handleRightPointerMove}
                onPointerUp={handleRightPointerUp}
            >
                <div className="w-[3px] h-6 rounded-full bg-white/20 group-hover/trim:bg-white/70 transition" />
            </div>
        </div>
    );
}

// ─── Audio Waveform ──────────────────────────────────────────────────────────

function AudioWaveform({ url, color }: { url: string; color: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!AC || !url) return;
        let cancelled = false;

        const canvas = canvasRef.current;
        if (!canvas) return;
        const w = canvas.offsetWidth  || 200;
        const h = canvas.offsetHeight || 40;
        canvas.width  = w;
        canvas.height = h;

        getWaveformData(url, Math.floor(w / 2)).then(peaks => {
            if (cancelled || !canvasRef.current) return;
            const ctx = canvasRef.current.getContext('2d')!;
            ctx.clearRect(0, 0, w, h);

            const barW = w / peaks.length;
            const midY = h / 2;
            ctx.fillStyle = color + 'CC';

            for (let i = 0; i < peaks.length; i++) {
                const barH = Math.max(2, peaks[i] * h * 0.9);
                ctx.fillRect(i * barW, midY - barH / 2, Math.max(1, barW - 0.5), barH);
            }
            setReady(true);
        });

        return () => { cancelled = true; };
    }, [url, color]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full opacity-70"
            style={{ display: 'block' }}
        />
    );
}

// ─── Video Thumbnail ─────────────────────────────────────────────────────────

function VideoThumbnail({ url }: { url: string }) {
    const [thumb, setThumb] = useState('');

    useEffect(() => {
        if (!url) return;
        let cancelled = false;
        getVideoThumb(url).then(t => { if (!cancelled) setThumb(t); });
        return () => { cancelled = true; };
    }, [url]);

    if (!thumb) return null;

    return (
        <div className="absolute inset-0 overflow-hidden">
            {/* Tile the thumbnail across the clip width */}
            <img
                src={thumb}
                alt=""
                className="h-full w-full object-cover opacity-50"
                style={{ imageRendering: 'crisp-edges' }}
            />
        </div>
    );
}
