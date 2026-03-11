"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { getMusicGenerations } from "@/app/actions/musicStudio";
import { Loader2, ArrowLeft, Volume2, Save, Music, AlertTriangle, Clapperboard, Check } from "lucide-react";
import Link from "next/link";
import WaveformPlayer from "@/app/studio/creator/_components/WaveformPlayer";

export default function EditorPage() {
    const params = useParams();
    const router = useRouter();
    const videoId = params.id as string;

    const [videoInfo, setVideoInfo] = useState<any>(null);
    const [musicTracks, setMusicTracks] = useState<any[]>([]);

    // Editor State
    const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
    const [videoVol, setVideoVol] = useState(1.0);
    const [musicVol, setMusicVol] = useState(0.2);

    // Status
    const [loading, setLoading] = useState(true);
    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [finalVideo, setFinalVideo] = useState<string | null>(null);

    // Live Preview elements (for playing both so user gets a rough idea)
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        async function load() {
            const supabase = createSupabaseBrowserClient();

            // Fetch video
            const { data: vRow, error: vErr } = await supabase
                .from("video_generations")
                .select("*")
                .eq("id", videoId)
                .single();

            if (vErr || !vRow) {
                setError("Video not found.");
                setLoading(false);
                return;
            }
            setVideoInfo(vRow);

            // Fetch music
            const mRes = await getMusicGenerations();
            if (mRes.success && mRes.generations) {
                setMusicTracks(mRes.generations);
            }

            setLoading(false);
        }
        load();
    }, [videoId]);

    // Handle Live Preview Sync
    const handlePlayPause = () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            videoRef.current.pause();
            if (audioRef.current) audioRef.current.pause();
            setIsPlaying(false);
        } else {
            videoRef.current.play();
            if (audioRef.current && selectedTrack) {
                audioRef.current.play();
            }
            setIsPlaying(true);
        }
    };

    // Keep preview volumes synced with slider
    useEffect(() => {
        if (videoRef.current) videoRef.current.volume = Math.min(videoVol, 1.0);
    }, [videoVol]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = Math.min(musicVol, 1.0);
    }, [musicVol]);

    useEffect(() => {
        // Switch track
        if (audioRef.current) {
            if (selectedTrack) {
                const trk = musicTracks.find(t => t.id === selectedTrack);
                if (trk) {
                    audioRef.current.src = trk.audio_url;
                    if (isPlaying) audioRef.current.play();
                }
            } else {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        }
    }, [selectedTrack, musicTracks]);

    const handleRender = async () => {
        if (!videoInfo?.video_url || !selectedTrack) return;

        setRendering(true);
        setError(null);

        const trk = musicTracks.find(t => t.id === selectedTrack);

        try {
            const res = await fetch("/api/mix-audio", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    videoUrl: videoInfo.video_url,
                    musicUrl: trk.audio_url,
                    videoVolume: videoVol,
                    musicVolume: musicVol
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to render");

            setFinalVideo(data.videoUrl);
        } catch (e: any) {
            setError(e.message || "An error occurred during render.");
        } finally {
            setRendering(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-24 pb-12 flex items-center justify-center">
                <Loader2 className="animate-spin text-primary w-8 h-8" />
            </div>
        );
    }

    if (error && !videoInfo) {
        return (
            <div className="min-h-screen pt-24 pb-12 px-4 max-w-xl mx-auto text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h1 className="text-2xl font-bold mb-2">Error</h1>
                <p className="text-white/60 mb-8">{error}</p>
                <Link href="/library" className="px-6 py-3 bg-white/10 rounded-xl hover:bg-white/20 transition">Back to Library</Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
            <Link href="/library" className="inline-flex items-center text-white/50 hover:text-white transition gap-2 mb-8 font-medium">
                <ArrowLeft size={18} /> Back to Library
            </Link>

            <div className="flex items-center gap-3 mb-8">
                <Clapperboard className="text-primary w-8 h-8" />
                <h1 className="text-3xl font-extrabold tracking-tight">Audio Mixer</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Col - Video & Preview */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-black/40 rounded-3xl overflow-hidden border border-white/10 relative shadow-2xl">
                        {finalVideo ? (
                            <div className="relative aspect-video">
                                <video src={finalVideo} className="w-full h-full object-contain bg-black" controls autoPlay />
                                <div className="absolute top-4 right-4 bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-md">
                                    <Check size={14} /> Final Render
                                </div>
                            </div>
                        ) : (
                            <div className="relative aspect-video bg-black group" onClick={handlePlayPause}>
                                <video
                                    ref={videoRef}
                                    src={videoInfo.video_url}
                                    className="w-full h-full object-contain"
                                    loop
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    onEnded={() => {
                                        setIsPlaying(false);
                                        if (audioRef.current) audioRef.current.pause();
                                    }}
                                />
                                {/* Hidden Audio element for simulating the mix */}
                                <audio ref={audioRef} loop />

                                {!isPlaying && (
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
                                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/30 cursor-pointer hover:scale-105 transition-transform">
                                            <div className="w-0 h-0 border-t-8 border-t-transparent border-l-12 border-l-white border-b-8 border-b-transparent ml-1"></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {finalVideo && (
                        <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-green-400 mb-1">Render Complete!</h3>
                                <p className="text-sm text-green-400/70">Your mixed video has been saved to your library.</p>
                            </div>
                            <a
                                href={finalVideo}
                                download="mixed_video.mp4"
                                className="px-6 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-xl transition shadow-[0_0_15px_-3px_#22c55e]"
                            >
                                Download Target
                            </a>
                        </div>
                    )}
                </div>

                {/* Right Col - Controls */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-[#121212] rounded-3xl p-6 border border-white/5 shadow-xl">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <Volume2 className="text-primary" /> Volume Controls
                        </h2>

                        <div className="space-y-8">
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-sm font-bold text-white/80">Original Video Audio (Dialogue)</label>
                                    <span className="text-xs text-white/50 bg-black/30 px-2 py-1 rounded">{(videoVol * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="2" step="0.05"
                                    value={videoVol}
                                    onChange={(e) => setVideoVol(parseFloat(e.target.value))}
                                    className="w-full accent-primary h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-sm font-bold text-indigo-400">Background Music</label>
                                    <span className="text-xs text-white/50 bg-black/30 px-2 py-1 rounded">{(musicVol * 100).toFixed(0)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0" max="2" step="0.05"
                                    value={musicVol}
                                    onChange={(e) => setMusicVol(parseFloat(e.target.value))}
                                    className="w-full accent-indigo-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                                    disabled={!selectedTrack}
                                />
                                {!selectedTrack && <p className="text-xs text-white/40 mt-2">Select a track below to enable background music.</p>}
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#121212] rounded-3xl border border-white/5 shadow-xl flex flex-col h-[400px]">
                        <div className="p-6 border-b border-white/5">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Music className="text-indigo-400" /> Select Background Track
                            </h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                            {musicTracks.length === 0 ? (
                                <div className="h-full flex flex-col justify-center items-center text-center p-6 gap-2">
                                    <Music className="w-8 h-8 text-white/20" />
                                    <p className="text-white/40 text-sm">No music tracks found.</p>
                                    <Link href="/studio/creator?tab=music" className="text-indigo-400 text-sm hover:underline">
                                        Generate some in the Music Studio
                                    </Link>
                                </div>
                            ) : (
                                musicTracks.map(trk => (
                                    <div
                                        key={trk.id}
                                        className={`p-4 rounded-2xl transition-all border ${selectedTrack === trk.id
                                            ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]'
                                            : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-black/40'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-3 gap-4">
                                            <p className="text-sm font-medium line-clamp-2 text-white/80">
                                                "{trk.prompt}"
                                            </p>
                                            <button
                                                onClick={() => setSelectedTrack(selectedTrack === trk.id ? null : trk.id)}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg shrink-0 transition-colors ${selectedTrack === trk.id ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}
                                            >
                                                {selectedTrack === trk.id ? 'Selected' : 'Select'}
                                            </button>
                                        </div>
                                        <div className="opacity-90 hover:opacity-100 transition-opacity">
                                            <WaveformPlayer audioUrl={trk.audio_url} />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-start gap-3">
                            <AlertTriangle className="shrink-0 w-5 h-5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        onClick={handleRender}
                        disabled={rendering || !selectedTrack || !!finalVideo}
                        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-lg ${rendering || !selectedTrack || !!finalVideo
                            ? 'bg-zinc-800 text-white/30 border border-white/5 cursor-not-allowed'
                            : 'bg-primary hover:bg-lime-400 text-black shadow-primary/20 hover:-translate-y-1'
                            }`}
                    >
                        {rendering ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Rendering Quality File (Takes ~10s)...
                            </>
                        ) : finalVideo ? (
                            <>
                                <Check className="w-5 h-5" /> Render Complete
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" /> Render Final Video (5 Cr)
                            </>
                        )}
                    </button>
                    {!selectedTrack && !finalVideo && (
                        <p className="text-xs text-center text-white/40">Please select a music track to render.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
