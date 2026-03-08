"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Loader2, Download, AlertTriangle, ListMusic, Plus, Trash2, X, AudioLines, Sparkles, Play, Pause } from "lucide-react";
import { generateTTS, getVoices } from "@/app/actions/falVoice";
import { getVoiceGenerations, deleteVoiceGeneration } from "@/app/actions/voiceStudio";
import WaveformPlayer from "./WaveformPlayer";
import VoiceCloneWizard from "./VoiceCloneWizard";
import { supabase } from "@/lib/supabaseClient";

interface VoiceTabProps {
    userCredits: number | null;
    isAdmin: boolean;
    onCreditsUsed: (amount: number) => void;
}

export default function VoiceTab({ userCredits, isAdmin, onCreditsUsed }: VoiceTabProps) {
    const [text, setText] = useState("");
    const [voices, setVoices] = useState<any[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // History 
    const [generations, setGenerations] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Cloning Modal
    const [isCloning, setIsCloning] = useState(false);

    // Preview Playback
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const VOICE_COST = 5;
    const hasCredits = isAdmin || (userCredits ?? 0) >= VOICE_COST;

    const fetchData = async () => {
        setLoadingHistory(true);
        const [voicesRes, historyRes] = await Promise.all([
            getVoices(),
            getVoiceGenerations()
        ]);

        if (voicesRes.success && voicesRes.voices) {
            setVoices(voicesRes.voices);
            if (voicesRes.voices.length > 0 && !selectedVoice) {
                const firstCloned = voicesRes.voices.find(v => v.type === 'cloned');
                if (firstCloned) {
                    setSelectedVoice(firstCloned.id);
                } else {
                    setSelectedVoice(voicesRes.voices[0].id);
                }
            }
        }

        if (historyRes.success && historyRes.generations) {
            setGenerations(historyRes.generations);
        }
        setLoadingHistory(false);
    };

    useEffect(() => {
        fetchData();
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Stop playback when selected voice changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            setIsPlayingPreview(false);
        }
    }, [selectedVoice]);

    const togglePreview = () => {
        if (!selectedVoice) return;
        const voiceObj = voices.find(v => v.id === selectedVoice);
        if (!voiceObj || !voiceObj.ref_audio_url) {
            alert("No preview audio available for this voice.");
            return;
        }

        if (isPlayingPreview && audioRef.current) {
            audioRef.current.pause();
            setIsPlayingPreview(false);
        } else {
            if (!audioRef.current) {
                audioRef.current = new Audio(voiceObj.ref_audio_url);
                audioRef.current.onended = () => setIsPlayingPreview(false);
            } else if (audioRef.current.src !== voiceObj.ref_audio_url) {
                audioRef.current.src = voiceObj.ref_audio_url;
            }
            audioRef.current.play().catch(e => console.error("Error playing preview:", e));
            setIsPlayingPreview(true);
        }
    };

    const handleGenerate = async () => {
        if (!text.trim()) {
            setError("Please enter some text to speak.");
            return;
        }
        if (!selectedVoice) {
            setError("Please select a voice.");
            return;
        }
        if (!hasCredits) {
            setError(`You need at least ${VOICE_COST} credits to generate a voiceover.`);
            return;
        }

        setError(null);
        setGenerating(true);

        try {
            const selectedVoiceObj = voices.find(v => v.id === selectedVoice);
            const refAudioUrl = selectedVoiceObj?.ref_audio_url || "";

            const res = await generateTTS(text, selectedVoice, refAudioUrl);
            if (res.success && res.audioUrl) {
                if (!isAdmin) onCreditsUsed(VOICE_COST);
                // Refresh history to show the new generation
                setText("");
                fetchData();
            } else {
                setError(res.error || "Failed to generate audio");
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this voiceover?")) return;
        setGenerations(prev => prev.filter(g => g.id !== id));
        await deleteVoiceGeneration(id);
    };

    return (
        <div className="w-full relative">
            <div className="flex items-end justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <AudioLines className="text-primary h-8 w-8" />
                        Voice Studio
                    </h2>
                    <p className="text-white/50 text-sm font-medium mt-1">
                        Clone your voice or use premium presets to bring your scripts to life.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Drawer: Generation & Cloning */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl shadow-xl ring-1 ring-white/5 flex flex-col h-full relative overflow-hidden">

                        {/* Decorative Background Glow */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none" />

                        <div className="flex items-center justify-between mb-6">
                            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">
                                1. Select Voice
                            </label>
                            <button
                                onClick={() => setIsCloning(true)}
                                className="text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 text-primary hover:text-white bg-primary/10 hover:bg-primary/30 py-1.5 px-3 rounded-full transition-all border border-primary/20"
                            >
                                <Plus size={12} strokeWidth={3} />
                                Clone Voice
                            </button>
                        </div>

                        <div className="flex gap-3 mb-6">
                            <select
                                value={selectedVoice || ""}
                                onChange={(e) => setSelectedVoice(e.target.value)}
                                className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-inner"
                                disabled={generating || voices.length === 0}
                            >
                                {voices.length === 0 && <option value="">Loading voices...</option>}
                                {voices.filter(v => v.type === 'cloned').length > 0 && (
                                    <optgroup label="YOUR CLONED VOICES">
                                        {voices.filter(v => v.type === 'cloned').map(v => (
                                            <option key={v.id} value={v.id}>⭐ {v.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                                <optgroup label="PREMIUM PRESETS">
                                    {voices.filter(v => v.type === 'preset').map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </optgroup>
                            </select>

                            <button
                                onClick={togglePreview}
                                disabled={!selectedVoice || !voices.find(v => v.id === selectedVoice)?.ref_audio_url}
                                className="shrink-0 aspect-square h-[50px] w-[50px] flex justify-center items-center bg-white/5 hover:bg-primary/20 hover:text-primary text-white/50 border border-white/10 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-white/50"
                                title="Preview Voice"
                            >
                                {isPlayingPreview ? (
                                    <Pause fill="currentColor" size={20} />
                                ) : (
                                    <Play fill="currentColor" size={20} className="ml-1" />
                                )}
                            </button>
                        </div>

                        <label className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide flex justify-between">
                            <span>2. Enter Script</span>
                            <span className="text-white/30">{text.length} chars</span>
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Type exactly what you want the AI to say..."
                            className="w-full flex-grow min-h-[160px] bg-black/50 border border-white/10 rounded-xl p-5 text-[15px] leading-relaxed text-foreground placeholder:text-white/20 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 mb-6 shadow-inner font-medium"
                            disabled={generating}
                        />

                        {error && (
                            <div className="mb-6 text-xs text-red-200 bg-red-500/10 p-4 rounded-xl border border-red-500/20 flex items-start gap-3">
                                <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
                                <span className="font-medium leading-relaxed">{error}</span>
                            </div>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={generating || !hasCredits || !text.trim()}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-primary to-purple-600 px-8 py-4.5 text-[13px] font-black tracking-[0.1em] text-white transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(192,132,252,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none active:scale-[0.98] uppercase"
                        >
                            {generating ? (
                                <>
                                    <Loader2 size={18} className="animate-spin text-white/70" />
                                    GENERATING...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} className="text-white/70" />
                                    GENERATE AUDIO ({VOICE_COST}c)
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Right Drawer: Library / History */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center gap-2 mb-2 px-2">
                        <ListMusic className="text-white/40" size={18} />
                        <h3 className="text-sm font-bold text-white/70 uppercase tracking-widest">Generation Library</h3>
                    </div>

                    <div className="space-y-4 custom-scrollbar pr-2 max-h-[600px] overflow-y-auto">
                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-3xl border border-white/5 ring-1 ring-white/5">
                                <Loader2 className="animate-spin text-primary mb-4" size={32} />
                                <p className="text-sm text-white/40 font-bold uppercase tracking-widest">Loading Library...</p>
                            </div>
                        ) : generations.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 bg-white/5 rounded-3xl border border-white/5 ring-1 ring-white/5 backdrop-blur-sm text-center px-8">
                                <div className="w-20 h-20 rounded-full bg-black/40 border border-white/10 flex items-center justify-center mb-6 shadow-inner">
                                    <Mic className="text-white/20" size={32} />
                                </div>
                                <h4 className="text-lg font-bold text-white mb-2">Your Studio is empty</h4>
                                <p className="text-sm text-white/40 max-w-[280px] leading-relaxed">
                                    Generations will appear here. Listen, download, or map them to your videos.
                                </p>
                            </div>
                        ) : (
                            generations.map(gen => (
                                <div key={gen.id} className="group relative bg-[#111] border border-white/[0.08] hover:border-white/20 transition-all rounded-3xl p-5 shadow-lg overflow-hidden flex flex-col gap-4">
                                    {/* Action Header */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 w-fit">
                                            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                                            <span className="text-[10px] font-bold tracking-widest text-primary uppercase">{gen.voice_name || 'Voice'}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <a
                                                href={gen.audio_url}
                                                download="voiceover.wav"
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl"
                                                title="Download Audio"
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
                                    <p className="text-sm text-white/80 font-medium leading-relaxed line-clamp-2 pr-8">
                                        "{gen.text_prompt}"
                                    </p>

                                    {/* Waveform Player */}
                                    <WaveformPlayer audioUrl={gen.audio_url} />
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Cloning Wizard Modal */}
            <VoiceCloneWizard
                isOpen={isCloning}
                onClose={() => setIsCloning(false)}
                onComplete={() => {
                    setIsCloning(false);
                    fetchData();
                }}
            />
        </div>
    );
}
