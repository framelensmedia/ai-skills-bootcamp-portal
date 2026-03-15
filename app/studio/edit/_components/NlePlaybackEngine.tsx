"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useNle, TimelineClip, TimelineTrack } from "../_context/NleContext";

/**
 * NLE Playback Engine — Persistent Media Pool Edition
 *
 * All clips from all tracks are rendered as hidden <video>/<audio> elements
 * at all times so they stay buffered (preloaded). During playback:
 *   - We compute which clips are "active" at the current playhead.
 *   - Active clips get display:block / .play(), inactive ones get display:none / .pause().
 *   - Every 150ms we nudge currentTime if drift > 80ms so audio/video stay in sync.
 *   - Clip entries/exits happen silently — no mount/unmount, no stutter.
 */
export default function NlePlaybackEngine({ isFullscreen = false }: { isFullscreen?: boolean }) {
    const {
        playhead, setPlayhead,
        isPlaying, setIsPlaying,
        duration, tracks, aspectRatio,
        playheadRef, isLooping,
    } = useNle();

    const isPlayingRef   = useRef(isPlaying);
    const durationRef    = useRef(duration);
    const tracksRef      = useRef(tracks);
    const isLoopingRef   = useRef(isLooping);

    useEffect(() => { isPlayingRef.current = isPlaying; },   [isPlaying]);
    useEffect(() => { durationRef.current  = duration; },    [duration]);
    useEffect(() => { tracksRef.current    = tracks; },      [tracks]);
    useEffect(() => { isLoopingRef.current = isLooping; },   [isLooping]);

    // ── Master rAF loop refs ──
    const requestRef       = useRef<number | undefined>(undefined);
    const lastFrameTimeRef = useRef<number | undefined>(undefined);
    const lastSyncRef      = useRef<number>(0);

    // ── Media element pools: keyed by clip.id ──
    const mediaPoolRef = useRef<Map<string, HTMLVideoElement | HTMLAudioElement>>(new Map());
    const imagePoolRef = useRef<Map<string, HTMLImageElement>>(new Map());

    const registerMedia = useCallback((id: string, el: HTMLVideoElement | HTMLAudioElement | null) => {
        if (el) { mediaPoolRef.current.set(id, el); } else { mediaPoolRef.current.delete(id); }
    }, []);

    const registerImage = useCallback((id: string, el: HTMLImageElement | null) => {
        if (el) { imagePoolRef.current.set(id, el); } else { imagePoolRef.current.delete(id); }
    }, []);

    // ── Helpers ──
    const isClipActive = (clip: TimelineClip, time: number) => {
        const clipDuration = clip.outPoint - clip.inPoint;
        return time >= clip.startTime && time < clip.startTime + clipDuration;
    };

    /**
     * Sync every media element to the master clock.
     * - Active clips: visible, playing, time-corrected if drifted.
     * - Inactive clips: paused + hidden (still buffered).
     */
    const syncAllMedia = useCallback((currentTime: number, playing: boolean) => {
        tracksRef.current.forEach(track => {
            if (!track.visible) {
                // Track hidden — pause & hide everything
                track.clips.forEach(clip => {
                    const el = mediaPoolRef.current.get(clip.id);
                    if (el) { if (!el.paused) el.pause(); (el as HTMLElement).style.display = 'none'; }
                    const img = imagePoolRef.current.get(clip.id);
                    if (img) img.style.display = 'none';
                });
                return;
            }

            track.clips.forEach(clip => {
                const active = isClipActive(clip, currentTime);

                // ── Image clips ──
                if (clip.mediaType === 'image') {
                    const img = imagePoolRef.current.get(clip.id);
                    if (img) img.style.display = active ? '' : 'none';
                    return;
                }

                // ── Audio / Video clips ──
                const el = mediaPoolRef.current.get(clip.id);
                if (!el) return;

                const vol = Math.min(clip.volume * (track.muted ? 0 : track.volume), 1.0);

                if (active) {
                    (el as HTMLElement).style.display = '';
                    el.volume = vol;
                    el.muted  = vol === 0;
                    const expectedTime = (currentTime - clip.startTime) + clip.inPoint;
                    const drift = Math.abs(el.currentTime - expectedTime);
                    const threshold = playing ? 0.08 : 0.02;
                    if (drift > threshold) el.currentTime = expectedTime;
                    if (playing && el.paused)  el.play().catch(() => {});
                    if (!playing && !el.paused) el.pause();
                } else {
                    (el as HTMLElement).style.display = 'none';
                    if (!el.paused) el.pause();
                }
            });
        });
    }, []);

    // ── Master rAF Loop ──
    const animate = useCallback((timestamp: number) => {
        if (!isPlayingRef.current) return;

        if (lastFrameTimeRef.current !== undefined) {
            const delta = (timestamp - lastFrameTimeRef.current) / 1000;
            playheadRef.current = Math.min(playheadRef.current + delta, durationRef.current);

            if (playheadRef.current >= durationRef.current) {
                if (isLoopingRef.current) {
                    // Loop: reset to 0 and continue
                    playheadRef.current = 0;
                    setPlayhead(0);
                    syncAllMedia(0, true);
                } else {
                    // Stop
                    playheadRef.current = 0;
                    setPlayhead(0);
                    setIsPlaying(false);
                    syncAllMedia(0, false);
                    return;
                }
            }

            // Every 150ms: sync React state + drift-correct all media
            if (timestamp - lastSyncRef.current > 150) {
                lastSyncRef.current = timestamp;
                setPlayhead(playheadRef.current); // update timecode/playhead line
                syncAllMedia(playheadRef.current, true);
            }
        }

        lastFrameTimeRef.current = timestamp;
        requestRef.current = requestAnimationFrame(animate);
    }, [setPlayhead, setIsPlaying, playheadRef, syncAllMedia]);

    // ── Play / Pause ──
    useEffect(() => {
        if (isPlaying) {
            lastFrameTimeRef.current = undefined;
            lastSyncRef.current = 0;
            // Immediately snap all media to correct positions before starting rAF
            syncAllMedia(playheadRef.current, true);
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            setPlayhead(playheadRef.current);
            // Pause + show correct frame at playhead
            syncAllMedia(playheadRef.current, false);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlaying]);

    // ── Scrubbing while paused ──
    useEffect(() => {
        if (!isPlaying) {
            syncAllMedia(playhead, false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playhead, tracks]);

    // ── Track mute/volume changes during playback ──
    useEffect(() => {
        if (isPlaying) {
            syncAllMedia(playheadRef.current, true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tracks]);

    // ── Canvas Sizing ──
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const obs = new ResizeObserver(entries => {
            if (!entries[0]) return;
            setContainerSize({
                width:  entries[0].contentRect.width,
                height: entries[0].contentRect.height,
            });
        });
        if (containerRef.current) obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const ratio = aspectRatio === '16:9' ? 16 / 9 : aspectRatio === '1:1' ? 1 : 9 / 16;
    let canvasWidth  = containerSize.width;
    let canvasHeight = canvasWidth / ratio;
    if (canvasHeight > containerSize.height) {
        canvasHeight = containerSize.height;
        canvasWidth  = canvasHeight * ratio;
    }

    // ── Flatten all clips for the persistent media pool render ──
    const allClips: { clip: TimelineClip; track: TimelineTrack }[] = [];
    tracks.forEach(track => {
        track.clips.forEach(clip => {
            allClips.push({ clip, track });
        });
    });

    const hasAnyMedia = allClips.length > 0;

    return (
        <div
            ref={containerRef}
            className="flex-1 w-full h-full bg-black relative flex items-center justify-center p-2 lg:p-4 min-h-0 min-w-0"
        >
            <div
                style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
                className="bg-[#090909] rounded-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden flex items-center justify-center flex-shrink-0"
            >
                {!hasAnyMedia && (
                    <p className="text-white/20 font-mono text-sm uppercase tracking-widest z-0">
                        No Media at Playhead
                    </p>
                )}

                {/* Persistent media pool — always mounted, shown/hidden via CSS */}
                {allClips.map(({ clip, track }) => (
                    <PersistentClipRenderer
                        key={clip.id}
                        clip={clip}
                        trackVisible={track.visible}
                        registerMedia={registerMedia}
                        registerImage={registerImage}
                    />
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PersistentClipRenderer
// Mounts once per clip and never unmounts until the clip is removed from the
// track. The syncAllMedia() function above drives visibility/play/pause.
// ─────────────────────────────────────────────────────────────────────────────

interface PersistentClipRendererProps {
    clip: TimelineClip;
    trackVisible: boolean;
    registerMedia: (id: string, el: HTMLVideoElement | HTMLAudioElement | null) => void;
    registerImage: (id: string, el: HTMLImageElement | null) => void;
}

function PersistentClipRenderer({ clip, trackVisible, registerMedia, registerImage }: PersistentClipRendererProps) {
    const sharedStyle: React.CSSProperties = {
        position:  'absolute',
        left:      `${clip.x      ?? 0}%`,
        top:       `${clip.y      ?? 0}%`,
        width:     `${clip.width  ?? 100}%`,
        height:    `${clip.height ?? 100}%`,
        opacity:   clip.opacity ?? 1.0,
        objectFit: 'contain',
        display:   'none', // syncAllMedia() controls visibility
    };

    if (clip.mediaType === 'video') {
        return (
            <video
                ref={el => registerMedia(clip.id, el)}
                src={clip.url}
                playsInline
                preload="auto"
                style={sharedStyle}
            />
        );
    }

    if (clip.mediaType === 'image') {
        return (
            <img
                ref={el => registerImage(clip.id, el)}
                src={clip.url}
                alt=""
                style={sharedStyle}
            />
        );
    }

    // audio / voice / music
    return (
        <audio
            ref={el => registerMedia(clip.id, el)}
            src={clip.url}
            preload="auto"
            style={{ display: 'none' }}
        />
    );
}
