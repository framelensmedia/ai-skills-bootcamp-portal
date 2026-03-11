"use client";

import React, { createContext, useContext, useState, useMemo } from 'react';

export type MediaType = 'video' | 'audio' | 'image' | 'voice' | 'music';

export interface TimelineClip {
    id: string; // Unique ID for this clip on the timeline
    assetId: string; // ID of the source asset from the DB
    mediaType: MediaType;
    url: string; // Public URL of the media
    duration: number; // Total native duration of the asset in seconds

    // Timeline Placement
    startTime: number; // When does this clip start playing on the timeline?

    // Clip Trimming
    inPoint: number; // Offset into the native asset to start playing
    outPoint: number; // Offset into the native asset to stop playing

    // Audio Mixer
    volume: number; // 0.0 to 1.0 (or higher to boost)

    // Video Properties
    x?: number; // X position percentage (0-100)
    y?: number; // Y position percentage (0-100)
    width?: number; // Width percentage (0-100)
    height?: number; // Height percentage (0-100)
    opacity?: number; // 0.0 to 1.0
}

export interface TimelineTrack {
    id: string;
    name: string;
    visible: boolean;
    muted: boolean;
    clips: TimelineClip[];
}

// === NLE State Interface ===

interface NleState {
    // Timeline State
    tracks: TimelineTrack[];
    duration: number; // Total length of the project in seconds
    playhead: number; // Current playback position in seconds
    isPlaying: boolean;

    // Selection
    selectedClipId: string | null;
    selectedTrackId: string | null;

    // Zoom
    zoomLevel: number; // Pixels per second

    // Setters
    setPlayhead: React.Dispatch<React.SetStateAction<number>>;
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
    setSelectedClipId: (id: string | null) => void;
    setSelectedTrackId: (id: string | null) => void;

    // Mutations
    addTrack: (name: string) => void;
    duplicateTrack: (trackId: string) => void;
    removeTrack: (trackId: string) => void;
    toggleTrackMute: (trackId: string) => void;
    toggleTrackVisibility: (trackId: string) => void;
    addClipToTrack: (trackId: string, clip: Omit<TimelineClip, 'id'>) => void;
    updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
    removeClip: (trackId: string, clipId: string) => void;

    // Calculated Getters
    getClipsAtTime: (time: number) => { track: TimelineTrack, clip: TimelineClip }[];
}

const NleContext = createContext<NleState | undefined>(undefined);

export function NleProvider({ children }: { children: React.ReactNode }) {

    // Default Initial State: 3 Generic Tracks
    const [tracks, setTracks] = useState<TimelineTrack[]>([
        { id: 't3', name: 'Track 3', visible: true, muted: false, clips: [] },
        { id: 't2', name: 'Track 2', visible: true, muted: false, clips: [] },
        { id: 't1', name: 'Track 1', visible: true, muted: false, clips: [] },
    ]);

    const [playhead, setPlayhead] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(50); // 50px per second by default

    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

    // Auto-calculate project duration based on the furthest outPoint of any clip
    const duration = useMemo(() => {
        let max = 15; // Minimum 15 second timeline
        tracks.forEach(t => {
            t.clips.forEach(c => {
                const end = c.startTime + (c.outPoint - c.inPoint);
                if (end > max) max = end;
            });
        });
        return Math.ceil(max) + 5; // Add 5 seconds of padding at the end
    }, [tracks]);

    // Mutations
    const addTrack = (name: string) => {
        const newTrack: TimelineTrack = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            visible: true,
            muted: false,
            clips: []
        };
        setTracks(prev => [newTrack, ...prev]);
    };

    const removeTrack = (trackId: string) => {
        setTracks(prev => prev.filter(t => t.id !== trackId));
    };

    const duplicateTrack = (trackId: string) => {
        setTracks(prev => {
            const trackToCopy = prev.find(t => t.id === trackId);
            if (!trackToCopy) return prev;

            const newTrack: TimelineTrack = {
                ...trackToCopy,
                id: Math.random().toString(36).substr(2, 9),
                name: `${trackToCopy.name} (Copy)`,
                clips: trackToCopy.clips.map(c => ({
                    ...c,
                    id: Math.random().toString(36).substr(2, 9)
                }))
            };

            const index = prev.findIndex(t => t.id === trackId);
            const newTracks = [...prev];
            newTracks.splice(index + 1, 0, newTrack);
            return newTracks;
        });
    };

    const toggleTrackMute = (trackId: string) => {
        setTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
    };

    const toggleTrackVisibility = (trackId: string) => {
        setTracks(prev => prev.map(t => t.id === trackId ? { ...t, visible: !t.visible } : t));
    };

    const addClipToTrack = (trackId: string, clip: Omit<TimelineClip, 'id'>) => {
        const newClip: TimelineClip = { ...clip, id: Math.random().toString(36).substr(2, 9) };
        setTracks(prev => prev.map(t => {
            if (t.id === trackId) {
                return { ...t, clips: [...t.clips, newClip] };
            }
            return t;
        }));
    };

    const updateClip = (trackId: string, clipId: string, updates: Partial<TimelineClip>) => {
        setTracks(prev => prev.map(t => {
            if (t.id === trackId) {
                return {
                    ...t,
                    clips: t.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
                };
            }
            return t;
        }));
    };

    const removeClip = (trackId: string, clipId: string) => {
        setTracks(prev => prev.map(t => {
            if (t.id === trackId) {
                return { ...t, clips: t.clips.filter(c => c.id !== clipId) };
            }
            return t;
        }));
    };

    const getClipsAtTime = (time: number) => {
        const activeClips: { track: TimelineTrack, clip: TimelineClip }[] = [];
        tracks.forEach(t => {
            t.clips.forEach(c => {
                const duration = c.outPoint - c.inPoint;
                if (time >= c.startTime && time <= c.startTime + duration) {
                    activeClips.push({ track: t, clip: c });
                }
            });
        });
        return activeClips;
    };

    return (
        <NleContext.Provider value={{
            tracks, duration, playhead, isPlaying, zoomLevel,
            selectedClipId, selectedTrackId,
            setPlayhead, setIsPlaying, setZoomLevel, setSelectedClipId, setSelectedTrackId,
            addTrack, duplicateTrack, removeTrack, toggleTrackMute, toggleTrackVisibility, addClipToTrack, updateClip, removeClip, getClipsAtTime
        }}>
            {children}
        </NleContext.Provider>
    );
}

export const useNle = () => {
    const ctx = useContext(NleContext);
    if (!ctx) throw new Error('useNle must be used within NleProvider');
    return ctx;
};
