"use client";

import { useState, useEffect } from "react";
import { Mic, Loader2, Download, AlertTriangle, ListMusic, Plus, Trash2, X, AudioLines, Sparkles, Music } from "lucide-react";
import { getMusicGenerations, deleteMusicGeneration } from "@/app/actions/musicStudio";
import WaveformPlayer from "./WaveformPlayer";
import { supabase } from "@/lib/supabaseClient";

interface MusicTabProps {
    userCredits: number | null;
    isAdmin: boolean;
    onCreditsUsed: (amount: number) => void;
}

export default function MusicTab({ userCredits, isAdmin, onCreditsUsed }: MusicTabProps) {
    const [prompt, setPrompt] = useState("");
    const [lyrics, setLyrics] = useState("");
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // History 
    const [generations, setGenerations] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const MUSIC_COST = 10;
    const hasCredits = isAdmin || (userCredits ?? 0) >= MUSIC_COST;

    const fetchData = async () => {
        setLoadingHistory(true);
        const res = await getMusicGenerations();
        if (res.success && res.generations) {
            setGenerations(res.generations);
        }
        setLoadingHistory(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            setError("Please enter a description for your music track.");
            return;
        }
        if (!hasCredits) {
            setError(`You need at least ${MUSIC_COST} credits to generate music.`);
            return;
        }

        setError(null);
        setGenerating(true);

        try {
            const res = await fetch("/api/generate-music", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, lyrics: lyrics.trim() }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to generate music");
            }

            if (!isAdmin) onCreditsUsed(MUSIC_COST);

            // Refresh history to show the new generation
            setPrompt("");
            setLyrics("");
            fetchData();

        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this track?")) return;

        try {
            const res = await deleteMusicGeneration(id);
            if (res.success) {
                fetchData();
            } else {
                alert("Failed to delete track: " + res.error);
            }
        } catch (e) {
            console.error(e);
            alert("Error deleting track.");
        }
    };

    return (
        <div className="w-full flex justify-center py-6 px-4 md:px-0 mt-8 mb-24">
            <div className="flex flex-col lg:flex-row gap-8 w-full max-w-[1400px]">

                {/* Left Side - Production Tools */}
                <div className="lg:w-[45%] flex flex-col gap-6">
                    <div className="mb-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
                                <Music className="text-indigo-400" size={20} />
                            </div>
                            <h2 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-md">
                                Music Studio
                            </h2>
                        </div>
                        <p className="text-white/50 text-sm font-medium leading-relaxed max-w-sm ml-13">
                            Describe a vibe, genre, and instruments, and MiniMax v2 will compose a unique background track for you.
                        </p>
                    </div>

                    <div className="bg-gradient-to-b from-[#1E1E1E] to-[#121212] rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                        <div className="flex flex-col gap-5 relative z-10">

                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles size={16} className="text-indigo-400" />
                                <span className="text-sm font-bold text-white tracking-wide uppercase">Music Prompt</span>
                            </div>

                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="E.g. A chill lofi hip hop beat with a smooth saxophone melody, relaxed tempo, and gentle drums..."
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all min-h-[140px]"
                            />

                            <div className="flex items-center gap-2 mb-1 mt-2">
                                <Mic size={16} className="text-pink-400" />
                                <span className="text-sm font-bold text-white tracking-wide uppercase">Lyrics (Optional)</span>
                            </div>

                            <textarea
                                value={lyrics}
                                onChange={(e) => setLyrics(e.target.value)}
                                placeholder="Leave blank for an instrumental track. Or paste lyrics here and the AI will sing them in the style you described above!"
                                className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-pink-500/50 resize-none transition-all min-h-[140px]"
                            />

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg text-sm border border-red-400/20">
                                    <AlertTriangle size={16} className="shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={generating || !prompt.trim() || !hasCredits}
                                className={`
                                    w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2
                                    transition-all duration-300 transform shadow-lg
                                    ${generating || !prompt.trim() || !hasCredits
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/5'
                                        : 'bg-indigo-500 hover:bg-indigo-400 hover:-translate-y-1 text-white shadow-indigo-500/25'}
                                `}
                            >
                                {generating ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin text-white/50" />
                                        <span>Generating Track... (Takes ~1-2m)</span>
                                    </>
                                ) : (
                                    <>
                                        <AudioLines size={18} />
                                        <span>Generate Track ({isAdmin ? "∞" : MUSIC_COST} Cr)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Beginner Tips Section */}
                    <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
                        <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider text-indigo-400">Pro Tips for Best Results</h4>
                        <ul className="space-y-3 text-sm text-white/60">
                            <li className="flex gap-3"><span className="text-indigo-400 font-bold">•</span> To make a pure beat, leave the lyrics box completely empty. MiniMax will automatically render a high-quality instrumental.</li>
                            <li className="flex gap-3"><span className="text-indigo-400 font-bold">•</span> In your Prompt, describe the exact genre, instruments, mood, and tempo: "Upbeat Atlanta trap hip hop with 808 bass slides and fast hi-hats."</li>
                            <li className="flex gap-3"><span className="text-indigo-400 font-bold">•</span> To structure your lyrics, use tags like [Verse], [Chorus], and [Bridge]. MiniMax respects these structural cues when singing!</li>
                        </ul>
                    </div>
                </div>

                {/* Right Side - Track Library */}
                <div className="lg:w-[55%] flex flex-col pt-2 lg:pt-0 pl-0 lg:pl-6">
                    <div className="flex items-center justify-between mb-8 pl-2">
                        <div className="flex items-center gap-2">
                            <ListMusic size={18} className="text-white/60" />
                            <h3 className="text-xl font-bold text-white/90">Your Tracks</h3>
                        </div>
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 text-white/40 tracking-wider">
                            {generations.length} {generations.length === 1 ? 'Track' : 'Tracks'}
                        </span>
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="animate-spin text-indigo-500/50" />
                            </div>
                        ) : generations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-48 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                                <Music size={32} className="text-white/20 mb-3" />
                                <p className="text-white/40 font-medium">No music generated yet.</p>
                                <p className="text-white/30 text-sm mt-1">Tracks you generate will appear here.</p>
                            </div>
                        ) : (
                            generations.map((gen) => (
                                <div key={gen.id} className="group bg-gradient-to-r from-black/60 to-black/40 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/30 transition-all hover:bg-black w-full shadow-md">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                                                <AudioLines size={14} />
                                            </div>
                                            <span className="text-xs font-bold text-white/40 font-mono">
                                                {new Date(gen.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <a
                                                href={gen.audio_url}
                                                download={`track-${gen.id.substring(0, 6)}.mp3`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-white/50 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-xl"
                                                title="Download Track"
                                            >
                                                <Download size={16} />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(gen.id)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-400/50 hover:text-red-400 hover:bg-red-400/10 rounded-xl"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Prompt Text truncated */}
                                    <p className="text-sm text-white/80 font-medium leading-relaxed line-clamp-2 pr-8 mb-4">
                                        "{gen.prompt}"
                                    </p>

                                    {/* Waveform Player */}
                                    <WaveformPlayer audioUrl={gen.audio_url} />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
