"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, Search, Loader2, Clapperboard } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type LibraryVideo = {
    id: string;
    video_url: string;
    created_at: string;
    prompt?: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (videoUrl: string, promptId?: string) => void;
};

export default function LibraryVideoPickerModal({ isOpen, onClose, onSelect }: Props) {
    const [items, setItems] = useState<LibraryVideo[]>([]);
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

                const { data, error } = await supabase
                    .from("video_generations")
                    .select("id, video_url, created_at, prompt")
                    .eq("user_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(100);

                if (error) throw error;
                setItems(data || []);
            } catch (err) {
                console.error("Failed to fetch library:", err);
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
                            <Clapperboard className="text-primary" size={20} />
                            Your Video Library
                        </h2>
                        <p className="text-xs text-white/40">Select a video to use as motion reference</p>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                            <input
                                type="text"
                                placeholder="Search videos..."
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
                            <div className="text-sm font-mono tracking-widest uppercase">Fetching Videos</div>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-white/20">
                            <Clapperboard size={60} strokeWidth={1} />
                            <div className="text-sm">No videos found</div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
                            {filteredItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        onSelect(item.video_url, item.id);
                                        onClose();
                                    }}
                                    className="group relative aspect-video rounded-xl overflow-hidden border border-white/5 bg-white/5 transition-all hover:border-primary/50 hover:scale-[1.02] shadow-lg flex items-center justify-center text-left"
                                >
                                    <video
                                        src={item.video_url}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        preload="metadata"
                                        muted
                                        loop
                                        playsInline
                                        onMouseEnter={(e) => e.currentTarget.play()}
                                        onMouseLeave={(e) => e.currentTarget.pause()}
                                    />
                                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-10">
                                        <div className="text-xs text-white/90 line-clamp-2 leading-tight font-medium">
                                            {item.prompt || "Generated Video"}
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
                    <div className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                        {filteredItems.length} Videos Found
                    </div>
                    <div className="text-[10px] text-white/20 font-mono italic">
                        Hover to preview • Click to select
                    </div>
                </div>
            </div>
        </div>
    );
}
