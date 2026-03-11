"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { getMusicGenerations } from "@/app/actions/musicStudio";
import { Loader2, Clapperboard, Mic, Music, Plus, X } from "lucide-react";
import { useNle, MediaType, TimelineClip } from "../_context/NleContext";

interface NleLibraryModalProps {
    trackId: string;
    onClose: () => void;
}

export default function NleLibraryModal({ trackId, onClose }: NleLibraryModalProps) {
    const [loading, setLoading] = useState(true);
    const [videos, setVideos] = useState<any[]>([]);
    const [voices, setVoices] = useState<any[]>([]);
    const [music, setMusic] = useState<any[]>([]);

    const [videoLimit, setVideoLimit] = useState(10);
    const [voiceLimit, setVoiceLimit] = useState(10);
    const [musicLimit, setMusicLimit] = useState(10);

    const { addClipToTrack } = useNle();

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

        addClipToTrack(trackId, newClip);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-[#0A0A0A]">
                    <h2 className="font-bold text-white/80 text-sm">Library Assets</h2>
                    <button onClick={onClose} className="text-white/40 hover:text-white transition p-1.5 rounded-lg hover:bg-white/5">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-12 min-h-[300px]">
                        <Loader2 className="animate-spin text-white/40" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 p-4">
                        {/* Videos Section */}
                        <div>
                            <h3 className="text-xs font-bold text-white/50 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                <Clapperboard size={14} /> Videos ({videos.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {videos.slice(0, videoLimit).map(v => (
                                    <div key={v.id} onClick={() => handleAddAsset(v, 'video')} className="group cursor-pointer bg-[#1A1A1A] hover:bg-[#222] border border-white/5 hover:border-indigo-500/50 rounded-lg p-2 pr-3 flex items-center gap-3 transition">
                                        <div className="w-12 h-12 bg-black rounded shrink-0 relative overflow-hidden flex items-center justify-center group-hover:ring-2 ring-indigo-500 transition-all">
                                            {v.video_url ? (
                                                <video src={`${v.video_url}#t=0.1`} className="w-full h-full object-cover opacity-80" muted playsInline />
                                            ) : (
                                                <Clapperboard size={16} className="text-white/20" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-white/80 font-medium truncate">{v.prompt}</p>
                                        </div>
                                        <div className="w-6 h-6 rounded bg-white/5 group-hover:bg-indigo-500 text-white/50 group-hover:text-white flex items-center justify-center transition shrink-0">
                                            <Plus size={14} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {videos.length === 0 && <p className="text-xs text-white/30 italic">No videos found.</p>}
                            {videos.length > videoLimit && (
                                <button
                                    onClick={() => setVideoLimit(prev => prev + 10)}
                                    className="w-full mt-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-white/60 hover:text-white transition"
                                >
                                    Load More Videos
                                </button>
                            )}
                        </div>

                        {/* Voices Section */}
                        <div>
                            <h3 className="text-xs font-bold text-white/50 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                <Mic size={14} /> Voices ({voices.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {voices.slice(0, voiceLimit).map(v => (
                                    <div key={v.id} onClick={() => handleAddAsset(v, 'voice')} className="group cursor-pointer bg-[#1A1A1A] hover:bg-[#222] border border-white/5 hover:border-teal-500/50 rounded-lg p-2 pr-3 flex items-center gap-3 transition">
                                        <div className="w-8 h-8 bg-teal-500/10 text-teal-400 rounded shrink-0 flex items-center justify-center">
                                            <Mic size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-white/80 font-medium truncate">{v.prompt_text}</p>
                                        </div>
                                        <div className="w-6 h-6 rounded bg-white/5 group-hover:bg-teal-500 text-white/50 group-hover:text-white flex items-center justify-center transition shrink-0">
                                            <Plus size={14} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {voices.length === 0 && <p className="text-xs text-white/30 italic">No voices found.</p>}
                            {voices.length > voiceLimit && (
                                <button
                                    onClick={() => setVoiceLimit(prev => prev + 10)}
                                    className="w-full mt-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-white/60 hover:text-white transition"
                                >
                                    Load More Voices
                                </button>
                            )}
                        </div>

                        {/* Music Section */}
                        <div>
                            <h3 className="text-xs font-bold text-white/50 mb-3 flex items-center gap-2 uppercase tracking-wide">
                                <Music size={14} /> Music ({music.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {music.slice(0, musicLimit).map(m => (
                                    <div key={m.id} onClick={() => handleAddAsset(m, 'music')} className="group cursor-pointer bg-[#1A1A1A] hover:bg-[#222] border border-white/5 hover:border-pink-500/50 rounded-lg p-2 pr-3 flex items-center gap-3 transition">
                                        <div className="w-8 h-8 bg-pink-500/10 text-pink-400 rounded shrink-0 flex items-center justify-center">
                                            <Music size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-white/80 font-medium truncate">{m.prompt}</p>
                                        </div>
                                        <div className="w-6 h-6 rounded bg-white/5 group-hover:bg-pink-500 text-white/50 group-hover:text-white flex items-center justify-center transition shrink-0">
                                            <Plus size={14} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {music.length === 0 && <p className="text-xs text-white/30 italic">No music found.</p>}
                            {music.length > musicLimit && (
                                <button
                                    onClick={() => setMusicLimit(prev => prev + 10)}
                                    className="w-full mt-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-white/60 hover:text-white transition"
                                >
                                    Load More Music
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
