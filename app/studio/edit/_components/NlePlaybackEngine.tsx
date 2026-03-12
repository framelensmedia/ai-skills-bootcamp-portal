"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useNle, TimelineClip } from "../_context/NleContext";

/**
 * High-Performance NLE Playback Engine
 * 
 * During playback: Updates shared playheadRef (from context) on every rAF frame.
 * Syncs back to React state every ~250ms for UI updates (timecode, playhead line).
 * Media elements self-manage via native .play() — no per-frame seeking.
 */
export default function NlePlaybackEngine({ isFullscreen = false }: { isFullscreen?: boolean }) {
    const { playhead, setPlayhead, isPlaying, setIsPlaying, duration, tracks, aspectRatio, playheadRef } = useNle();

    const isPlayingRef = useRef(isPlaying);
    const durationRef = useRef(duration);
    const tracksRef = useRef(tracks);
    const requestRef = useRef<number | undefined>(undefined);
    const lastFrameTimeRef = useRef<number | undefined>(undefined);
    const lastSyncRef = useRef<number>(0);

    // Sync refs with React state
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { durationRef.current = duration; }, [duration]);
    useEffect(() => { tracksRef.current = tracks; }, [tracks]);

    // Active media clips (recalculated on play/stop/scrub + periodic sync)
    const [activeMedia, setActiveMedia] = useState<{ id: string, clip: TimelineClip, trackVolume: number }[]>([]);

    const getClipsAtTimeLocal = useCallback((time: number) => {
        const activeClips: { id: string, clip: TimelineClip, trackVolume: number }[] = [];
        tracksRef.current.forEach(t => {
            if (!t.visible) return;
            t.clips.forEach(c => {
                const clipDuration = c.outPoint - c.inPoint;
                if (time >= c.startTime && time <= c.startTime + clipDuration) {
                    activeClips.push({ id: c.id, clip: c, trackVolume: t.muted ? 0 : t.volume });
                }
            });
        });
        return activeClips;
    }, []);

    // Update active media when NOT playing (scrubbing / track changes)
    useEffect(() => {
        if (!isPlaying) {
            setActiveMedia(getClipsAtTimeLocal(playhead));
        }
    }, [playhead, isPlaying, tracks, getClipsAtTimeLocal]);

    // === Master Playback Loop ===
    const animate = useCallback((timestamp: number) => {
        if (!isPlayingRef.current) return;

        if (lastFrameTimeRef.current !== undefined) {
            const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
            playheadRef.current += deltaTime;

            if (playheadRef.current >= durationRef.current) {
                playheadRef.current = 0;
                setPlayhead(0);
                setIsPlaying(false);
                return;
            }

            // Periodic React state sync every ~250ms (for UI updates like timecode)
            if (timestamp - lastSyncRef.current > 250) {
                lastSyncRef.current = timestamp;
                setPlayhead(playheadRef.current);
            }
        }

        lastFrameTimeRef.current = timestamp;
        requestRef.current = requestAnimationFrame(animate);
    }, [setPlayhead, setIsPlaying, playheadRef]);

    // Start / Stop
    useEffect(() => {
        if (isPlaying) {
            playheadRef.current = playhead;
            lastFrameTimeRef.current = undefined;
            lastSyncRef.current = 0;
            setActiveMedia(getClipsAtTimeLocal(playhead));
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            // Final sync
            setPlayhead(playheadRef.current);
            setActiveMedia(getClipsAtTimeLocal(playheadRef.current));
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying]);

    // === Dynamic Sizing Logic ===
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const obs = new ResizeObserver((entries) => {
            if (!entries[0]) return;
            setContainerSize({
                width: entries[0].contentRect.width,
                height: entries[0].contentRect.height
            });
        });
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const ratio = aspectRatio === '16:9' ? 16 / 9 : aspectRatio === '1:1' ? 1 : 9 / 16;
    let canvasWidth = containerSize.width;
    let canvasHeight = canvasWidth / ratio;

    if (canvasHeight > containerSize.height) {
        canvasHeight = containerSize.height;
        canvasWidth = canvasHeight * ratio;
    }

    return (
        <div ref={containerRef} className="flex-1 w-full h-full bg-black relative flex items-center justify-center p-2 lg:p-4 min-h-0 min-w-0">
            <div
                style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
                className="bg-[#090909] rounded-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden flex items-center justify-center flex-shrink-0"
            >
                {activeMedia.length === 0 && (
                    <p className="text-white/20 font-mono text-sm uppercase tracking-widest z-0">No Media at Playhead</p>
                )}

                {activeMedia.map(({ id, clip, trackVolume }) => (
                    <div key={id} className="absolute inset-0">
                        {clip.mediaType === 'video' ? (
                            <VideoRenderer clip={clip} isPlaying={isPlaying} trackVolume={trackVolume} playheadRef={playheadRef} />
                        ) : clip.mediaType === 'image' ? (
                            <img src={clip.url} alt="" style={{
                                position: 'absolute', left: `${clip.x ?? 0}%`, top: `${clip.y ?? 0}%`,
                                width: `${clip.width ?? 100}%`, height: `${clip.height ?? 100}%`,
                                opacity: clip.opacity ?? 1.0, objectFit: 'contain'
                            }} />
                        ) : (
                            <AudioRenderer clip={clip} isPlaying={isPlaying} trackVolume={trackVolume} playheadRef={playheadRef} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// === Sub-Renderers ===

interface MediaRendererProps {
    clip: TimelineClip;
    isPlaying: boolean;
    trackVolume: number;
    playheadRef: React.MutableRefObject<number>;
}

function VideoRenderer({ clip, isPlaying, trackVolume, playheadRef }: MediaRendererProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        video.volume = Math.min(clip.volume * trackVolume, 1.0);

        const mediaTime = (playheadRef.current - clip.startTime) + clip.inPoint;
        video.currentTime = mediaTime;

        if (isPlaying) {
            video.play().catch(() => { });
        } else {
            video.pause();
        }
    }, [isPlaying, clip.volume, trackVolume]);

    return (
        <video ref={videoRef} src={clip.url} muted={clip.volume === 0 || trackVolume === 0} playsInline
            style={{
                position: 'absolute', left: `${clip.x ?? 0}%`, top: `${clip.y ?? 0}%`,
                width: `${clip.width ?? 100}%`, height: `${clip.height ?? 100}%`,
                opacity: clip.opacity ?? 1.0, objectFit: 'contain'
            }}
        />
    );
}

function AudioRenderer({ clip, isPlaying, trackVolume, playheadRef }: MediaRendererProps) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!audioRef.current) return;
        const audio = audioRef.current;
        audio.volume = Math.min(clip.volume * trackVolume, 1.0);

        const mediaTime = (playheadRef.current - clip.startTime) + clip.inPoint;
        audio.currentTime = mediaTime;

        if (isPlaying) {
            audio.play().catch(() => { });
        } else {
            audio.pause();
        }
    }, [isPlaying, clip.volume, trackVolume]);

    return (
        <audio ref={audioRef} src={clip.url} muted={clip.volume === 0 || trackVolume === 0} className="hidden" />
    );
}
