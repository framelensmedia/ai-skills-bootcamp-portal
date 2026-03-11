"use client";

import { useState, useEffect } from "react";
import { X, Search, Loader2, AudioLines, Music, Mic } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type LibraryAudio = {
    id: string;
    audio_url: string;
    created_at: string;
    prompt?: string;
    type: 'voice' | 'music';
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (audioUrl: string, promptId?: string) => void;
};

export default function LibraryAudioPickerModal({ isOpen, onClose, onSelect }: Props) {
    const [items, setItems] = useState<LibraryAudio[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        if (!isOpen) return;

        const fetchLibrary = async () => {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Fetch from both tables
                const [voiceRes, musicRes] = await Promise.all([
                    supabase
                        .from("voice_generations")
                        .select("id, audio_url, created_at, text_prompt")
                        .eq("user_id", user.id)
                        .order("created_at", { ascending: false })
                        .limit(50),
                    supabase
                        .from("music_generations")
                        .select("id, audio_url, created_at, prompt")
                        .eq("user_id", user.id)
                        .order("created_at", { ascending: false })
                        .limit(50)
                ]);

                if (voiceRes.error) console.error(voiceRes.error);
                if (musicRes.error) console.error(musicRes.error);

                const voiceData = (voiceRes.data || []).map((item: any) => ({
                    id: item.id,
                    audio_url: item.audio_url,
                    created_at: item.created_at,
                    prompt: item.text_prompt,
                    type: 'voice' as const
                }));

                const musicData = (musicRes.data || []).map((item: any) => ({
                    id: item.id,
                    audio_url: item.audio_url,
                    created_at: item.created_at,
                    prompt: item.prompt,
                    type: 'music' as const
                }));

                // Combine and sort by date descending
                const combined = [...voiceData, ...musicData]
                    .filter(item => item.audio_url) // Ensure URL exists
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                setItems(combined);
            } catch (err) {
                console.error("Failed to fetch audio library:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchLibrary();
    }, [isOpen, supabase]);

    if (!isOpen) return null;

    const filteredItems = items.filter(item =>
        item.prompt?.toLowerCase().includes(search.toLowerCase()) ||
        !search
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
            <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#09090b] shadow-2xl h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex flex-col gap-4 items-start sm:flex-row sm:items-center sm:justify-between sticky top-0 bg-[#09090b]/95 backdrop-blur z-20">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <AudioLines className="text-primary" size={20} />
                            Your Audio Library
                        </h2>
                        <p className="text-xs text-white/40">Select music or voice to sync with a video</p>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                            <input
                                type="text"
                                placeholder="Search audio..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-full py-2 pl-9 pr-4 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 w-full sm:w-48 transition-all focus:w-full sm:focus:w-64"
                            />
                        </div>
                        <button
                            onClick={onClose}
                            className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-white/20">
                            <Loader2 className="animate-spin text-primary" size={40} />
                            <div className="text-sm font-mono tracking-widest uppercase">Fetching Audio</div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-white/20">
                            <AudioLines size={60} strokeWidth={1} />
                            <div className="text-sm">No audio found</div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {filteredItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="group relative rounded-xl overflow-hidden border border-white/5 bg-white/5 transition-all hover:border-primary/50 flex flex-col p-4 shadow-lg text-left"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={`p-2 rounded-full ${item.type === 'voice' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {item.type === 'voice' ? <Mic size={16} /> : <Music size={16} />}
                                        </div>
                                        <button
                                            onClick={() => {
                                                onSelect(item.audio_url, item.id);
                                                onClose();
                                            }}
                                            className="bg-primary/20 hover:bg-primary text-primary hover:text-black px-3 py-1 rounded-full text-xs font-bold transition-colors"
                                        >
                                            Select
                                        </button>
                                    </div>
                                    <div className="text-xs text-white/90 line-clamp-2 leading-tight font-medium h-8 mb-4">
                                        {item.prompt || `Generated ${item.type === 'voice' ? 'Voice' : 'Music'}`}
                                    </div>
                                    <audio
                                        src={item.audio_url}
                                        controls
                                        className="w-full h-8 opacity-70 group-hover:opacity-100 transition-opacity"
                                        preload="none"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
                    <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                        {filteredItems.length} Audio Files Found
                    </div>
                    <div className="text-[10px] text-white/20 font-mono italic">
                        Listen to preview • Click select to use
                    </div>
                </div>
            </div>
        </div>
    );
}
