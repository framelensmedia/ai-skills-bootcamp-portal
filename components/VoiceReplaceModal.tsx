"use client";

import { useState, useEffect, useRef } from "react";
import { X, Mic, AudioLines, Loader2, Check, AlertTriangle, ChevronRight, Play, Pause } from "lucide-react";
import { getVoices } from "@/app/actions/falVoice";

interface VoiceReplaceModalProps {
    isOpen: boolean;
    videoUrl: string;
    onClose: () => void;
    onSuccess: (newVideoUrl: string, newItemId?: string) => void;
}

const MODE_OPTIONS = [
    {
        id: "s2s",
        label: "Replace Voice",
        icon: "🎙️",
        description: "Replaces the speaker's voice while preserving their timing & cadence. Best for matching lip sync.",
        badge: "Speech to Speech",
        badgeColor: "text-cyan-400 bg-cyan-400/10 border border-cyan-400/20",
    },
    {
        id: "voiceover",
        label: "Add Voiceover",
        icon: "🎬",
        description: "Replaces all audio with a freshly spoken script in your chosen voice. Lip sync not guaranteed.",
        badge: "Custom Script",
        badgeColor: "text-amber-400 bg-amber-400/10 border border-amber-400/20",
    },
];

export default function VoiceReplaceModal({ isOpen, videoUrl, onClose, onSuccess }: VoiceReplaceModalProps) {
    const [mode, setMode] = useState<"s2s" | "voiceover">("s2s");
    const [voices, setVoices] = useState<any[]>([]);
    const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
    const [script, setScript] = useState("");
    const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

    const previewAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setStatus("idle");
        setResultUrl(null);
        setErrorMsg("");
        setScript("");

        getVoices().then(res => {
            if (res.success && res.voices) {
                setVoices(res.voices);
                // Default to first cloned voice or first preset
                const first = res.voices.find(v => v.type === "cloned") || res.voices[0];
                if (first) setSelectedVoiceId(first.id);
            }
        });
    }, [isOpen]);

    useEffect(() => {
        // Stop preview when voice changes
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            setIsPreviewPlaying(false);
        }
    }, [selectedVoiceId]);

    const selectedVoice = voices.find(v => v.id === selectedVoiceId);

    const togglePreview = () => {
        if (!selectedVoice?.ref_audio_url) return;
        if (isPreviewPlaying && previewAudioRef.current) {
            previewAudioRef.current.pause();
            setIsPreviewPlaying(false);
        } else {
            if (!previewAudioRef.current) {
                previewAudioRef.current = new Audio(selectedVoice.ref_audio_url);
                previewAudioRef.current.onended = () => setIsPreviewPlaying(false);
            } else if (previewAudioRef.current.src !== selectedVoice.ref_audio_url) {
                previewAudioRef.current.src = selectedVoice.ref_audio_url;
            }
            previewAudioRef.current.play().catch(() => { });
            setIsPreviewPlaying(true);
        }
    };

    const handleSubmit = async () => {
        if (!selectedVoiceId) return;
        if (mode === "voiceover" && !script.trim()) {
            setErrorMsg("Please enter a script for the voiceover.");
            return;
        }

        setStatus("processing");
        setErrorMsg("");

        try {
            const res = await fetch("/api/replace-voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    videoUrl,
                    mode,
                    voiceId: selectedVoiceId,
                    refAudioUrl: selectedVoice?.ref_audio_url || "",
                    script: script.trim(),
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to process video");

            setResultUrl(data.videoUrl);
            setStatus("done");
            onSuccess(data.videoUrl, data.id);
        } catch (e: any) {
            setErrorMsg(e.message || "An unexpected error occurred.");
            setStatus("error");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0f0f11] max-w-2xl w-full rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div className="bg-cyan-400/15 p-2 rounded-xl border border-cyan-400/20">
                            <Mic className="text-cyan-400" size={22} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Voice Replacement</h3>
                            <p className="text-xs text-white/40">Apply a voice to your video</p>
                        </div>
                    </div>
                    {status !== "processing" && (
                        <button onClick={onClose} className="text-white/30 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl">
                            <X size={18} />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Mode Selector */}
                    {status === "idle" || status === "error" ? (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                {MODE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => setMode(opt.id as any)}
                                        className={`text-left p-4 rounded-2xl border transition-all ${mode === opt.id
                                            ? "bg-white/10 border-white/20 shadow-inner"
                                            : "bg-black/30 border-white/5 hover:border-white/10 hover:bg-white/5"
                                            }`}
                                    >
                                        <div className="text-2xl mb-2">{opt.icon}</div>
                                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                            <span className="font-bold text-sm text-white">{opt.label}</span>
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${opt.badgeColor}`}>
                                                {opt.badge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/40 leading-relaxed">{opt.description}</p>
                                    </button>
                                ))}
                            </div>

                            {/* Voice Selector */}
                            <div>
                                <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-3">
                                    Select Voice
                                </label>
                                <div className="flex gap-3">
                                    <select
                                        value={selectedVoiceId}
                                        onChange={e => setSelectedVoiceId(e.target.value)}
                                        className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                                    >
                                        {voices.filter(v => v.type === "cloned").length > 0 && (
                                            <optgroup label="YOUR CLONED VOICES">
                                                {voices.filter(v => v.type === "cloned").map(v => (
                                                    <option key={v.id} value={v.id}>⭐ {v.name}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <optgroup label="PREMIUM PRESETS">
                                            {voices.filter(v => v.type === "preset").map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                    {selectedVoice?.ref_audio_url && (
                                        <button
                                            onClick={togglePreview}
                                            className="shrink-0 w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-cyan-400/20 hover:text-cyan-400 text-white/60 border border-white/10 rounded-xl transition-all"
                                            title="Preview Voice"
                                        >
                                            {isPreviewPlaying ? <Pause fill="currentColor" size={18} /> : <Play fill="currentColor" size={18} className="ml-0.5" />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Script Input — only for Voiceover mode */}
                            {mode === "voiceover" && (
                                <div>
                                    <label className="text-xs font-bold text-white/50 uppercase tracking-widest block mb-3 flex justify-between">
                                        <span>Voiceover Script</span>
                                        <span className="text-white/30 normal-case tracking-normal">{script.length} chars</span>
                                    </label>
                                    <textarea
                                        value={script}
                                        onChange={e => setScript(e.target.value)}
                                        placeholder="Enter the exact words you want the AI to speak..."
                                        rows={4}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white resize-none focus:outline-none focus:ring-2 focus:ring-cyan-400/40 placeholder:text-white/20"
                                    />
                                    <p className="text-xs text-amber-400/70 mt-2 flex items-center gap-1.5">
                                        <AlertTriangle size={12} />
                                        Audio replaces all existing video sound. Lip sync is not guaranteed.
                                    </p>
                                </div>
                            )}

                            {mode === "s2s" && (
                                <div className="bg-cyan-400/5 border border-cyan-400/15 rounded-2xl p-4 text-xs text-cyan-300/70 leading-relaxed">
                                    <strong className="text-cyan-300">How it works:</strong> The original voice in your video will be extracted and converted to your selected voice style. The natural timing and pacing of the original speech is preserved for the best lip sync match.
                                </div>
                            )}

                            {errorMsg && (
                                <div className="text-sm font-medium text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 flex items-start gap-2.5">
                                    <AlertTriangle className="shrink-0 mt-0.5" size={16} />
                                    {errorMsg}
                                </div>
                            )}
                        </>
                    ) : status === "processing" ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <div className="w-24 h-24 rounded-full border border-cyan-400/20 bg-cyan-400/5 flex items-center justify-center relative">
                                <div className="absolute inset-0 rounded-full border-[3px] border-t-cyan-400 border-cyan-400/10 animate-spin" />
                                <AudioLines className="text-cyan-400 animate-pulse" size={32} />
                            </div>
                            <div className="text-center">
                                <h4 className="text-xl font-bold text-white mb-1">
                                    {mode === "s2s" ? "Replacing Voice..." : "Generating Voiceover..."}
                                </h4>
                                <p className="text-white/40 text-sm">
                                    {mode === "s2s"
                                        ? "Extracting audio, converting voice, and merging back..."
                                        : "Generating speech and merging audio track..."
                                    }
                                </p>
                                <p className="text-white/25 text-xs mt-2">This may take up to 2 minutes</p>
                            </div>
                        </div>
                    ) : status === "done" && resultUrl ? (
                        <div className="flex flex-col items-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                <Check size={28} className="text-green-400" strokeWidth={3} />
                            </div>
                            <div className="text-center">
                                <h4 className="text-xl font-bold text-white">Done! Your video is ready.</h4>
                                <p className="text-white/40 text-sm mt-1">It has been saved to your library.</p>
                            </div>
                            <video src={resultUrl} controls className="w-full rounded-2xl mt-2 max-h-[280px] bg-black" />
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                {(status === "idle" || status === "error") && (
                    <div className="p-6 border-t border-white/5 bg-black/20 flex justify-between items-center">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl hover:bg-white/10 text-white/50 hover:text-white text-sm font-bold transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedVoiceId || (mode === "voiceover" && !script.trim())}
                            className="px-7 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {mode === "s2s" ? "Replace Voice" : "Generate & Apply"}
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
                {status === "done" && (
                    <div className="p-6 border-t border-white/5 bg-black/20 flex justify-end">
                        <button onClick={onClose} className="px-7 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold transition-all">
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
