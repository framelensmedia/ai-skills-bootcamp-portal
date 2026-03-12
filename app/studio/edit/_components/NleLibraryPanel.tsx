"use client";

import { useEffect, useState, useRef } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { getMusicGenerations } from "@/app/actions/musicStudio";
import { Loader2, Clapperboard, Mic, Music, Plus, Upload, LayoutGrid, List as ListIcon } from "lucide-react";
import { useNle, MediaType, TimelineClip } from "../_context/NleContext";

export default function NleLibraryPanel({ onClipAdded }: { onClipAdded?: () => void }) {
    const [loading, setLoading] = useState(true);
    const [videos, setVideos] = useState<any[]>([]);
    const [voices, setVoices] = useState<any[]>([]);
    const [music, setMusic] = useState<any[]>([]);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');

    const [videoLimit, setVideoLimit] = useState(12);
    const [voiceLimit, setVoiceLimit] = useState(12);
    const [musicLimit, setMusicLimit] = useState(12);

    const { addClipToTrack, activeTrackId, isFullscreen } = useNle();

    const videoInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function fetchAssets() {
            const supabase = createSupabaseBrowserClient();

            const [vRes, s2sRes, mRes] = await Promise.all([
                supabase.from("video_generations").select("*").order("created_at", { ascending: false }),
                supabase.from("voice_generations").select("*").order("created_at", { ascending: false }),
                getMusicGenerations()
            ]);

            if (vRes.data) setVideos(vRes.data);
            if (s2sRes.data) setVoices(s2sRes.data);
            if (mRes.success && mRes.generations) setMusic(mRes.generations);

            setLoading(false);
        }
        fetchAssets();
    }, []);

    const handleAddAsset = (asset: any, type: MediaType) => {
        const defaultDuration = 5;

        // Extract the public URL
        let url = "";
        if (type === 'video') url = asset.video_url;
        if (type === 'voice') url = asset.audio_url;
        if (type === 'music') url = asset.audio_url;

        const newClip: Omit<TimelineClip, 'id'> = {
            assetId: asset.id,
            mediaType: type,
            url: url,
            duration: defaultDuration,
            startTime: 0,
            inPoint: 0,
            outPoint: defaultDuration,
            volume: 1.0,
            x: 0, y: 0, width: 100, height: 100, opacity: 1.0
        };

        addClipToTrack(activeTrackId, newClip);
        onClipAdded?.();
    };

    const handleLocalUpload = (e: React.ChangeEvent<HTMLInputElement>, type: MediaType) => {
        if (e.target.files && e.target.files[0]) {
            const url = URL.createObjectURL(e.target.files[0]);
            const newClip: Omit<TimelineClip, 'id'> = {
                assetId: Math.random().toString(36).substr(2, 9),
                mediaType: type,
                url: url,
                duration: 5, // Default duration, could read file metadata ideally
                startTime: 0,
                inPoint: 0,
                outPoint: 5,
                volume: 1.0,
                x: 0, y: 0, width: 100, height: 100, opacity: 1.0
            };
            addClipToTrack(activeTrackId, newClip);
            onClipAdded?.();
        }
    };

    return (
        <div className={`flex flex-col bg-[#111] ${isFullscreen ? "border-r" : "border-r"} border-white/10 h-full w-full overflow-hidden`}>
            {/* Header */}
            <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#0A0A0A] shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="font-bold text-white/80 text-sm">Library</h2>
                    <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                        {activeTrackId.toUpperCase()}
                    </span>
                </div>

                {/* View Toggle */}
                <div className="flex bg-[#161616] rounded-lg p-0.5 border border-white/5">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow' : 'text-white/40 hover:text-white/70'}`}
                        title="List View"
                    >
                        <ListIcon size={14} />
                    </button>
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow' : 'text-white/40 hover:text-white/70'}`}
                        title="Grid View"
                    >
                        <LayoutGrid size={14} />
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center p-12 custom-scrollbar">
                    <Loader2 className="animate-spin text-white/40" />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 p-4">

                    {/* Videos Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-white/50 flex items-center gap-2 uppercase tracking-wide">
                                <Clapperboard size={14} /> Videos ({videos.length})
                            </h3>
                            <button onClick={() => videoInputRef.current?.click()} className="text-[10px] flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-white/60 transition">
                                <Upload size={10} /> Upload
                            </button>
                            <input type="file" ref={videoInputRef} onChange={(e) => handleLocalUpload(e, 'video')} accept="video/mp4,video/webm,video/quicktime" className="hidden" />
                        </div>
                        <div className={viewMode === 'grid' ? "grid grid-cols-4 gap-2" : "grid grid-cols-1 xl:grid-cols-2 gap-2"}>
                            {videos.slice(0, videoLimit).map(v => (
                                <div key={v.id} onClick={() => handleAddAsset(v, 'video')} className={`group cursor-pointer bg-[#1A1A1A] hover:bg-[#222] border border-white/5 hover:border-lime-500/50 rounded-lg transition overflow-hidden relative ${viewMode === 'grid' ? 'flex flex-col aspect-square' : 'p-2 pr-3 flex items-center gap-3'}`}>
                                    {/* Thumbnail Preview Area */}
                                    <div className={viewMode === 'grid' ? "flex-1 bg-black relative w-full overflow-hidden" : "w-12 h-12 bg-black rounded shrink-0 relative overflow-hidden flex items-center justify-center group-hover:ring-2 ring-lime-500 transition-all"}>
                                        {v.video_url ? (
                                            <video src={`${v.video_url}#t=0.1`} className="w-full h-full object-cover opacity-80" muted playsInline />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center"><Clapperboard size={16} className="text-white/20" /></div>
                                        )}
                                        {/* Overlay Add Button visible only in Grid mode */}
                                        {viewMode === 'grid' && (
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <div className="w-8 h-8 rounded-full bg-lime-400 text-black flex items-center justify-center scale-75 group-hover:scale-100 transition-transform">
                                                    <Plus size={18} />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Text Info Area */}
                                    {viewMode === 'grid' ? (
                                        <div className="p-2 h-8 flex items-center shrink-0 border-t border-white/5">
                                            <p className="text-[10px] text-white/60 font-medium truncate w-full">{v.prompt}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-white/80 font-medium truncate">{v.prompt}</p>
                                            </div>
                                            <div className="w-6 h-6 rounded bg-white/5 group-hover:bg-lime-400 text-black/50 group-hover:text-black flex items-center justify-center transition shrink-0">
                                                <Plus size={14} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        {videos.length === 0 && <p className="text-xs text-white/30 italic">No videos found.</p>}
                        {videos.length > videoLimit && (
                            <button
                                onClick={() => setVideoLimit(prev => prev + 12)}
                                className="w-full mt-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-white/60 hover:text-white transition"
                            >
                                Load More Videos
                            </button>
                        )}
                    </div>

                    {/* Voices/Audio Section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-bold text-white/50 flex items-center gap-2 uppercase tracking-wide">
                                <Mic size={14} /> Audio & Voice
                            </h3>
                            <button onClick={() => audioInputRef.current?.click()} className="text-[10px] flex items-center gap-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-white/60 transition">
                                <Upload size={10} /> Upload
                            </button>
                            <input type="file" ref={audioInputRef} onChange={(e) => handleLocalUpload(e, 'audio')} accept="audio/mp3,audio/wav,audio/mpeg" className="hidden" />
                        </div>
                        <div className={viewMode === 'grid' ? "grid grid-cols-4 gap-2" : "grid grid-cols-1 xl:grid-cols-2 gap-2"}>
                            {voices.slice(0, voiceLimit).map(v => (
                                <div key={v.id} onClick={() => handleAddAsset(v, 'voice')} className={`group cursor-pointer bg-[#1A1A1A] hover:bg-[#222] border border-white/5 hover:border-teal-500/50 rounded-lg overflow-hidden relative transition ${viewMode === 'grid' ? 'flex flex-col aspect-square' : 'p-2 pr-3 flex items-center gap-3'}`}>
                                    <div className={viewMode === 'grid' ? "flex-1 bg-teal-500/5 flex items-center justify-center relative w-full" : "w-8 h-8 bg-teal-500/10 text-teal-400 rounded shrink-0 flex items-center justify-center"}>
                                        <Mic size={viewMode === 'grid' ? 24 : 14} className="text-teal-400/50 group-hover:text-teal-400 transition-colors" />
                                        {viewMode === 'grid' && (
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <div className="w-8 h-8 rounded-full bg-teal-500 text-black flex items-center justify-center scale-75 group-hover:scale-100 transition-transform">
                                                    <Plus size={18} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {viewMode === 'grid' ? (
                                        <div className="p-2 h-8 flex items-center shrink-0 border-t border-white/5">
                                            <p className="text-[10px] text-white/60 font-medium truncate w-full">{v.prompt_text}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-white/80 font-medium truncate">{v.prompt_text}</p>
                                            </div>
                                            <div className="w-6 h-6 rounded bg-white/5 group-hover:bg-teal-500 text-white/50 group-hover:text-white flex items-center justify-center transition shrink-0">
                                                <Plus size={14} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            {music.slice(0, musicLimit).map(m => (
                                <div key={m.id} onClick={() => handleAddAsset(m, 'music')} className={`group cursor-pointer bg-[#1A1A1A] hover:bg-[#222] border border-white/5 hover:border-pink-500/50 rounded-lg overflow-hidden relative transition ${viewMode === 'grid' ? 'flex flex-col aspect-square' : 'p-2 pr-3 flex items-center gap-3'}`}>
                                    <div className={viewMode === 'grid' ? "flex-1 bg-pink-500/5 flex items-center justify-center relative w-full" : "w-8 h-8 bg-pink-500/10 text-pink-400 rounded shrink-0 flex items-center justify-center"}>
                                        <Music size={viewMode === 'grid' ? 24 : 14} className="text-pink-400/50 group-hover:text-pink-400 transition-colors" />
                                        {viewMode === 'grid' && (
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center scale-75 group-hover:scale-100 transition-transform">
                                                    <Plus size={18} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {viewMode === 'grid' ? (
                                        <div className="p-2 h-8 flex items-center shrink-0 border-t border-white/5">
                                            <p className="text-[10px] text-white/60 font-medium truncate w-full">{m.prompt}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-white/80 font-medium truncate">{m.prompt}</p>
                                            </div>
                                            <div className="w-6 h-6 rounded bg-white/5 group-hover:bg-pink-500 text-white/50 group-hover:text-white flex items-center justify-center transition shrink-0">
                                                <Plus size={14} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        {voices.length === 0 && music.length === 0 && <p className="text-xs text-white/30 italic">No audio found.</p>}
                        {(voices.length > voiceLimit || music.length > musicLimit) && (
                            <button
                                onClick={() => { setVoiceLimit(prev => prev + 12); setMusicLimit(prev => prev + 12); }}
                                className="w-full mt-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-white/60 hover:text-white transition"
                            >
                                Load More Audio
                            </button>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
}
