"use client";

import { useNle, TimelineClip, TimelineTrack } from "../_context/NleContext";
import { Rnd } from "react-rnd";
import { Eye, EyeOff, Volume2, VolumeX, Trash2, Plus, Copy } from "lucide-react";
import { useState } from "react";
import NleLibraryModal from "./NleLibraryModal";

export default function NleTimeline() {
    const { tracks, duration, zoomLevel, playhead, setPlayhead, isPlaying, duplicateTrack, toggleTrackMute, toggleTrackVisibility } = useNle();
    const [addingToTrack, setAddingToTrack] = useState<string | null>(null);

    return (
        <div className="h-72 bg-[#121212] shrink-0 flex flex-col border-t border-white/5 relative z-10">

            {/* Top Ruler / Playhead Controls */}
            <div className="h-8 border-b border-white/5 bg-[#1A1A1A] flex items-center relative overflow-hidden">
                {/* Left spacer for track headers */}
                <div className="w-64 h-full shrink-0 border-r border-white/5 bg-[#1F1F1F] flex items-center px-4 shadow-xl z-20">
                    <span className="text-[10px] text-white/30 font-mono tracking-widest uppercase">Timeline</span>
                </div>

                {/* Playhead Ruler */}
                <div
                    className="flex-1 h-full relative cursor-text bg-[length:50px_100%] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGgwLjV2NDBIMHptMTAgMjVoMC41djE1SDEwem0xMCAwaDAuNXYxNUgyMHptMTAgMGgwLjV2MTVIMzB6bTEwIDBoMC41djE1SDQweiIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')]"
                    onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        setPlayhead(clickX / zoomLevel);
                    }}
                >
                    {/* Playhead Line Indicator inside ruler */}
                    <div
                        className="absolute top-0 bottom-0 w-[11px] -ml-[5px] cursor-grab active:cursor-grabbing hover:bg-white/10 z-50 flex justify-center"
                        style={{ left: `${playhead * zoomLevel}px` }}
                    >
                        <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-red-500 mt-0" />
                        <div className="absolute top-[6px] bottom-0 w-[1px] bg-red-500" />
                    </div>

                    {/* Time markers every 1 second (based on zoom) */}
                    {Array.from({ length: duration }).map((_, i) => (
                        <span
                            key={i}
                            className="absolute text-[9px] text-white/30 font-mono top-1"
                            style={{ left: `${i * zoomLevel + 2}px` }}
                        >
                            00:{(i).toString().padStart(2, '0')}
                        </span>
                    ))}
                </div>
            </div>

            {/* Tracks Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex bg-[#0A0A0A]">

                {/* Track Headers (Fixed left) */}
                <div className="w-64 border-r border-white/5 bg-[#1A1A1A] flex flex-col shrink-0 z-20 shadow-xl relative">
                    {tracks.map(t => (
                        <TrackHeader
                            key={t.id}
                            track={t}
                            onAddClick={() => setAddingToTrack(t.id)}
                            onDuplicate={() => duplicateTrack(t.id)}
                            onToggleMute={() => toggleTrackMute(t.id)}
                            onToggleVisibility={() => toggleTrackVisibility(t.id)}
                        />
                    ))}
                </div>

                {/* Track Spans (Scrollable Right) */}
                <div className="flex-1 relative overflow-x-auto min-w-0" style={{ width: `${duration * zoomLevel}px` }}>
                    {/* Vertical Playhead Line across all tracks */}
                    <div
                        className="absolute top-0 bottom-0 w-[1px] bg-red-500/80 z-40 pointer-events-none shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                        style={{ left: `${playhead * zoomLevel}px` }}
                    />

                    {/* Render Track Rows */}
                    {tracks.map(t => <TrackRow key={t.id} track={t} />)}
                </div>

            </div>

            {addingToTrack && (
                <NleLibraryModal trackId={addingToTrack} onClose={() => setAddingToTrack(null)} />
            )}
        </div>
    );
}

// Subcomponents

interface TrackHeaderProps {
    track: TimelineTrack;
    onAddClick: () => void;
    onDuplicate: () => void;
    onToggleMute: () => void;
    onToggleVisibility: () => void;
}

function TrackHeader({ track, onAddClick, onDuplicate, onToggleMute, onToggleVisibility }: TrackHeaderProps) {
    return (
        <div className="h-16 border-b border-white/5 flex items-center px-4 justify-between group bg-[#111] hover:bg-[#1A1A1A] transition shrink-0 relative">
            <div className="flex flex-col">
                <span className="text-xs font-bold text-white/80">
                    {track.name}
                </span>
                <span className="text-[10px] text-white/30 uppercase mt-0.5">TRACK</span>
            </div>

            <div className="flex items-center gap-2 opacity-100 md:opacity-50 group-hover:opacity-100 transition">
                <button onClick={onDuplicate} title="Duplicate Track" className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70">
                    <Copy size={12} />
                </button>
                <button onClick={onToggleMute} title={track.muted ? "Unmute" : "Mute"} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70">
                    {track.muted ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
                </button>
                <button onClick={onToggleVisibility} title={track.visible ? "Hide" : "Show"} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70">
                    {track.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-red-400" />}
                </button>
                <button onClick={onAddClick} title="Add Media" className="w-6 h-6 rounded bg-indigo-500/20 hover:bg-indigo-500 flex items-center justify-center text-indigo-400 hover:text-white ml-2 transition">
                    <Plus size={14} />
                </button>
            </div>
        </div>
    );
}

function TrackRow({ track }: { track: TimelineTrack }) {
    const { zoomLevel } = useNle();

    return (
        <div
            className="h-16 border-b border-white/5 relative bg-[length:50px_100%] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI2NCI+PHBhdGggZD0iTTAgMEgwLjVWNjRIMHoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMSkiLz48L3N2Zz4=')] bg-repeat-x"
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
    let bColor = "border-indigo-500/30";
    let bgGradient = "from-indigo-500/20 to-indigo-500/5";
    let iconColor = "text-indigo-400";

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
