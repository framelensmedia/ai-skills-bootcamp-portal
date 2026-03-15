"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause } from "lucide-react";

interface WaveformPlayerProps {
    audioUrl: string;
    height?: number;
    waveColor?: string;
    progressColor?: string;
}

export default function WaveformPlayer({
    audioUrl,
    height = 40,
    waveColor = "rgba(255, 255, 255, 0.2)",
    progressColor = "#c084fc" // Primary purple theme
}: WaveformPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState("0:00");
    const [currentTime, setCurrentTime] = useState("0:00");
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let isMounted = true;
        if (!containerRef.current) return;

        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: waveColor,
            progressColor: progressColor,
            height: height,
            barWidth: 3,
            barGap: 2,
            barRadius: 3,
            cursorWidth: 0,
            url: audioUrl,
        });

        // Event listeners
        ws.on('ready', () => {
            if (!isMounted) return;
            setIsReady(true);
            const totalSeconds = ws.getDuration();
            setDuration(formatTime(totalSeconds));
        });

        ws.on('audioprocess', () => {
            if (!isMounted) return;
            setCurrentTime(formatTime(ws.getCurrentTime()));
        });

        ws.on('play', () => {
            if (!isMounted) return;
            setIsPlaying(true);
        });

        ws.on('pause', () => {
            if (!isMounted) return;
            setIsPlaying(false);
        });

        ws.on('finish', () => {
            if (!isMounted) return;
            setIsPlaying(false);
        });

        wavesurferRef.current = ws;

        return () => {
            isMounted = false;
            try {
                if (ws) {
                    ws.unAll();
                    ws.destroy();
                }
            } catch (error: any) {
                // Silently handle AbortError and other cleanup errors
                if (error.name !== 'AbortError' && error.message !== 'signal is aborted without reason') {
                    console.error('WaveSurfer destroy error:', error);
                }
            }
            wavesurferRef.current = null;
        };
    }, [audioUrl, height, waveColor, progressColor]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlay = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause();
        }
    };

    return (
        <div className="flex items-center gap-4 w-full bg-black/20 p-3 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md transition-all hover:bg-black/30">
            <button
                onClick={togglePlay}
                disabled={!isReady}
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-primary/20 hover:bg-primary/30 text-primary transition-all shadow-sm ring-1 ring-primary/20 disabled:opacity-50"
            >
                {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current ml-0.5" />}
            </button>

            <div className="flex-1 min-w-0" ref={containerRef} />

            <div className="text-[11px] font-mono text-white/40 flex-shrink-0 font-medium tracking-wider w-11 text-right">
                {isPlaying ? currentTime : duration}
            </div>
        </div>
    );
}
