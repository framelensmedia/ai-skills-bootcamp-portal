"use client";

import { useEffect, useRef, useState } from "react";
import { useNle, TimelineClip } from "../_context/NleContext";
import { Play, Pause, SkipBack } from "lucide-react";

export default function NlePlaybackEngine() {
    const { playhead, setPlayhead, isPlaying, setIsPlaying, duration, getClipsAtTime } = useNle();

    // Which clips should be visible/audible RIGHT NOW based on the playhead?
    const [activeMedia, setActiveMedia] = useState<{ id: string, clip: TimelineClip }[]>([]);

    // The master rAF loop reference
    const requestRef = useRef<number | undefined>(undefined);
    const lastTimeRef = useRef<number | undefined>(undefined);

    // 1. Calculate Active Clips whenever playhead changes
    useEffect(() => {
        const clips = getClipsAtTime(playhead).map(c => ({ id: c.clip.id, clip: c.clip }));
        setActiveMedia(clips);
    }, [playhead, getClipsAtTime]);


    // 2. The Playback Loop (Master Clock)
    const animate = (time: number) => {
        if (lastTimeRef.current != undefined && isPlaying) {
            const deltaTime = (time - lastTimeRef.current) / 1000; // diff in seconds

            setPlayhead((prev) => {
                const next = prev + deltaTime;
                if (next >= duration) {
                    setIsPlaying(false);
                    return 0; // Loop back or stop
                }
                return next;
            });
        }
        lastTimeRef.current = time;
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        } else if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPlaying, duration]);


    // Format Time Helper
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex-1 bg-black relative flex flex-col items-center justify-center border-b border-white/10 p-4">

            {/* 3. The Live Compositing Canvas */}
            <div className="aspect-video w-full max-w-4xl bg-[#090909] rounded-xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative overflow-hidden flex items-center justify-center">

                {activeMedia.length === 0 && (
                    <p className="text-white/20 font-mono text-sm uppercase tracking-widest z-0">No Media at Playhead</p>
                )}

                {/* Render all active clips */}
                {activeMedia.map(({ id, clip }) => {
                    // Calculate where we should be seeking within the media file
                    // Offset from the start of the clip + the inPoint trim
                    const currentMediaTime = (playhead - clip.startTime) + clip.inPoint;

                    if (clip.mediaType === 'video') {
                        return (
                            <VideoRenderer
                                key={id}
                                clip={clip}
                                mediaTime={currentMediaTime}
                                isPlaying={isPlaying}
                            />
                        );
                    } else if (clip.mediaType === 'image') {
                        return (
                            <img
                                key={id}
                                src={clip.url}
                                style={{
                                    position: 'absolute',
                                    left: `${clip.x ?? 0}%`,
                                    top: `${clip.y ?? 0}%`,
                                    width: `${clip.width ?? 100}%`,
                                    height: clip.height ? `${clip.height}%` : 'auto',
                                    opacity: clip.opacity ?? 1.0,
                                    objectFit: 'contain'
                                }}
                            />
                        );
                    } else {
                        // Audio / Voice
                        return (
                            <AudioRenderer
                                key={id}
                                clip={clip}
                                mediaTime={currentMediaTime}
                                isPlaying={isPlaying}
                            />
                        );
                    }
                })}
            </div>

            {/* 4. Playback Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/80 backdrop-blur-xl px-8 py-3 rounded-full border border-white/10 shadow-2xl">
                <button
                    onClick={() => { setPlayhead(0); setIsPlaying(false); }}
                    className="text-white/50 hover:text-white transition"
                >
                    <SkipBack size={20} className="fill-current" />
                </button>

                <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-12 h-12 bg-white text-black hover:bg-indigo-400 hover:scale-105 rounded-full flex items-center justify-center transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                >
                    {isPlaying ? <Pause size={24} className="fill-current" /> : <Play size={24} className="fill-current ml-1" />}
                </button>

                <span className="font-mono text-sm text-white/50 tracking-wider">
                    <span className="text-white">{formatTime(playhead)}</span> / {formatTime(duration)}
                </span>
            </div>

        </div>
    );
}

// === Sub-Renderers to handle syncing individual HTML5 elements ===

function VideoRenderer({ clip, mediaTime, isPlaying }: { clip: TimelineClip, mediaTime: number, isPlaying: boolean }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (!videoRef.current) return;

        // Sync the video time if we are out of sync by more than ~0.2s
        if (Math.abs(videoRef.current.currentTime - mediaTime) > 0.2) {
            videoRef.current.currentTime = mediaTime;
        }

        if (isPlaying && videoRef.current.paused) {
            videoRef.current.play().catch(() => { });
        } else if (!isPlaying && !videoRef.current.paused) {
            videoRef.current.pause();
        }

        // Clamp volume preview to 1.0 max
        videoRef.current.volume = Math.min(clip.volume, 1.0);

    }, [mediaTime, isPlaying, clip.volume]);

    return (
        <video
            ref={videoRef}
            src={clip.url}
            muted={clip.volume === 0}
            style={{
                position: 'absolute',
                left: `${clip.x ?? 0}%`,
                top: `${clip.y ?? 0}%`,
                width: `${clip.width ?? 100}%`,
                height: clip.height ? `${clip.height}%` : 'auto',
                opacity: clip.opacity ?? 1.0,
                objectFit: 'contain' // Prevent stretching
            }}
        />
    );
}

function AudioRenderer({ clip, mediaTime, isPlaying }: { clip: TimelineClip, mediaTime: number, isPlaying: boolean }) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
        if (!audioRef.current) return;

        // Sync the audio time if we are out of sync by more than ~0.2s
        if (Math.abs(audioRef.current.currentTime - mediaTime) > 0.2) {
            audioRef.current.currentTime = mediaTime;
        }

        if (isPlaying && audioRef.current.paused) {
            audioRef.current.play().catch(() => { });
        } else if (!isPlaying && !audioRef.current.paused) {
            audioRef.current.pause();
        }

        // Clamp volume preview to 1.0 max
        audioRef.current.volume = Math.min(clip.volume, 1.0);

    }, [mediaTime, isPlaying, clip.volume]);

    return (
        <audio
            ref={audioRef}
            src={clip.url}
            muted={clip.volume === 0}
            className="hidden" // Never visible
        />
    );
}
