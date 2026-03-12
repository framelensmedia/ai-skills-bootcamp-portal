"use client";

import React, { createContext, useContext, useState, useMemo, useRef, useEffect, useCallback } from 'react';

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
    volume: number; // 0.0 to 1.0 track-level volume multiplier
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
    activeTrackId: string; // The track where new media from the library will be placed

    // Zoom
    zoomLevel: number; // Pixels per second

    // Settings
    isFullscreen: boolean;
    setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
    aspectRatio: '16:9' | '9:16' | '1:1';
    setAspectRatio: React.Dispatch<React.SetStateAction<'16:9' | '9:16' | '1:1'>>;

    // High-performance ref for playhead (bypasses React during playback)
    playheadRef: React.MutableRefObject<number>;

    // Setters
    setPlayhead: React.Dispatch<React.SetStateAction<number>>;
    setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
    setSelectedClipId: (id: string | null) => void;
    setSelectedTrackId: (id: string | null) => void;
    setActiveTrackId: (id: string) => void;

    // Mutations
    addTrack: (name: string) => void;
    duplicateTrack: (trackId: string) => void;
    removeTrack: (trackId: string) => void;
    toggleTrackMute: (trackId: string) => void;
    toggleTrackVisibility: (trackId: string) => void;
    setTrackVolume: (trackId: string, volume: number) => void;
    addClipToTrack: (trackId: string, clip: Omit<TimelineClip, 'id'>) => void;
    updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
    removeClip: (trackId: string, clipId: string) => void;

    // Calculated Getters
    getClipsAtTime: (time: number) => { track: TimelineTrack, clip: TimelineClip }[];

    // Project Persistence
    projectId: string | null;
    projectName: string;
    setProjectName: (name: string) => void;
    isDraft: boolean;
    hasUnsavedChanges: boolean;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    saveProject: (asDraft?: boolean) => Promise<void>;
    loadProject: (id: string) => Promise<void>;
    newProject: () => void;
    setTracks: React.Dispatch<React.SetStateAction<TimelineTrack[]>>;
}

const NleContext = createContext<NleState | undefined>(undefined);

export function NleProvider({ children }: { children: React.ReactNode }) {

    const DEFAULT_TRACKS: TimelineTrack[] = [
        { id: 't3', name: 'Track 3', visible: true, muted: false, volume: 1.0, clips: [] },
        { id: 't2', name: 'Track 2', visible: true, muted: false, volume: 1.0, clips: [] },
        { id: 't1', name: 'Track 1', visible: true, muted: false, volume: 1.0, clips: [] },
    ];

    // Default Initial State: 3 Generic Tracks
    const [tracks, setTracks] = useState<TimelineTrack[]>(DEFAULT_TRACKS);

    const [playhead, setPlayhead] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(50); // 50px per second by default

    const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
    const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
    const [activeTrackId, setActiveTrackId] = useState<string>('t1');

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('9:16');

    // === Project Persistence State ===
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('Untitled Project');
    const [isDraft, setIsDraft] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // High-performance shared ref — updated by PlaybackEngine, read by Timeline/TransportBar
    const playheadRef = useRef(0);
    useEffect(() => { playheadRef.current = playhead; }, [playhead]);

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
            volume: 1.0,
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

    const setTrackVolume = (trackId: string, volume: number) => {
        setTracks(prev => prev.map(t => t.id === trackId ? { ...t, volume } : t));
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

    // Mark as unsaved whenever tracks change (after initial load)
    const isInitialLoad = useRef(true);
    useEffect(() => {
        if (isInitialLoad.current) {
            isInitialLoad.current = false;
            return;
        }
        setHasUnsavedChanges(true);
        setSaveStatus('idle');
    }, [tracks, aspectRatio]);

    // === Save Project ===
    const saveProject = useCallback(async (asDraft = true) => {
        try {
            setSaveStatus('saving');
            const projectData = { tracks, aspectRatio };

            if (projectId) {
                // Update existing project
                const res = await fetch(`/api/nle-projects/${projectId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: projectName, data: projectData, is_draft: asDraft }),
                });
                if (!res.ok) throw new Error('Failed to save');
            } else {
                // Create new project
                const res = await fetch('/api/nle-projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: projectName, data: projectData, is_draft: asDraft }),
                });
                if (!res.ok) throw new Error('Failed to create project');
                const { project } = await res.json();
                setProjectId(project.id);
                // Update URL without navigation
                window.history.replaceState(null, '', `/studio/edit?project=${project.id}`);
            }

            setIsDraft(asDraft);
            setHasUnsavedChanges(false);
            setSaveStatus('saved');

            // Reset status after 3s
            setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 3000);
        } catch (e) {
            console.error('Save project error:', e);
            setSaveStatus('error');
        }
    }, [projectId, projectName, tracks, aspectRatio]);

    // === Load Project ===
    const loadProject = useCallback(async (id: string) => {
        try {
            const res = await fetch(`/api/nle-projects/${id}`);
            if (!res.ok) throw new Error('Project not found');
            const { project } = await res.json();

            setProjectId(project.id);
            setProjectName(project.name);
            setIsDraft(project.is_draft);

            // Hydrate state from saved data
            const rawData = project.data;
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

            if (data?.tracks) setTracks(data.tracks);
            if (data?.aspectRatio) {
                setAspectRatio(data.aspectRatio);
            } else {
                setAspectRatio('9:16');
            }

            setPlayhead(0);
            playheadRef.current = 0;
            setHasUnsavedChanges(false);
            isInitialLoad.current = true; // Prevent the tracks useEffect from marking as unsaved
            setSaveStatus('saved');
        } catch (e) {
            console.error('Load project error:', e);
        }
    }, [setPlayhead]);

    // === New Project (reset to defaults) ===
    const newProject = useCallback(() => {
        setTracks(DEFAULT_TRACKS);
        setAspectRatio('9:16');
        setPlayhead(0);
        playheadRef.current = 0;
        setIsPlaying(false);
        setProjectId(null);
        setProjectName('Untitled Project');
        setIsDraft(true);
        setHasUnsavedChanges(false);
        isInitialLoad.current = true;
        setSaveStatus('idle');
        window.history.replaceState(null, '', '/studio/edit');
    }, [setPlayhead, setIsPlaying]);

    const getClipsAtTime = (time: number) => {
        const activeClips: { track: TimelineTrack, clip: TimelineClip }[] = [];
        tracks.forEach(t => {
            if (!t.visible) return; // Do not render clips from hidden tracks
            t.clips.forEach(c => {
                const duration = c.outPoint - c.inPoint;
                if (time >= c.startTime && time <= c.startTime + duration) {
                    // Override the piped trackVolume to 0 if the track is muted
                    activeClips.push({ track: { ...t, volume: t.muted ? 0 : t.volume }, clip: c });
                }
            });
        });
        return activeClips;
    };

    return (
        <NleContext.Provider value={{
            tracks, duration, playhead, isPlaying, zoomLevel,
            selectedClipId, selectedTrackId, activeTrackId, isFullscreen, aspectRatio, playheadRef,
            projectId, projectName, setProjectName, isDraft, hasUnsavedChanges, saveStatus, saveProject, loadProject, newProject, setTracks,
            setPlayhead, setIsPlaying, setZoomLevel, setSelectedClipId, setSelectedTrackId, setActiveTrackId, setIsFullscreen, setAspectRatio,
            addTrack, duplicateTrack, removeTrack, toggleTrackMute, toggleTrackVisibility, setTrackVolume, addClipToTrack, updateClip, removeClip, getClipsAtTime
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
