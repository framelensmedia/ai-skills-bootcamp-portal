"use client";

import { useState, useEffect } from "react";
import { X, Send, Calendar, Check, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Props = {
    isOpen: boolean;
    onClose: () => void;
    assetUrl: string | null;
    assetId?: string;
    mediaType?: "image" | "video";
    initialCaption?: string;
};

export default function SocialPublisherModal({ isOpen, onClose, assetUrl, assetId, mediaType = "image", initialCaption = "" }: Props) {
    const supabase = createSupabaseBrowserClient();
    const [caption, setCaption] = useState(initialCaption);
    const [platforms, setPlatforms] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [socialAccounts, setSocialAccounts] = useState<any[]>([]);
    const [fetchingAccounts, setFetchingAccounts] = useState(true);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Scheduling State
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduledFor, setScheduledFor] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setMessage(null);
            setCaption(initialCaption);
            setPlatforms([]);
            setIsScheduling(false);
            setScheduledFor("");
            return;
        }

        async function fetchAccounts() {
            setFetchingAccounts(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setFetchingAccounts(false);
                return;
            }

            const { data } = await supabase
                .from("social_accounts")
                .select("*")
                .eq("user_id", user.id);

            setSocialAccounts(data || []);
            setFetchingAccounts(false);
        }

        fetchAccounts();
    }, [isOpen, supabase, initialCaption]);

    if (!isOpen || !assetUrl) return null;

    const togglePlatform = (platform: string) => {
        if (platforms.includes(platform)) {
            setPlatforms(platforms.filter(p => p !== platform));
        } else {
            setPlatforms([...platforms, platform]);
        }
    };

    const hasAccountFor = (platform: string) => {
        return socialAccounts.some(a => a.platform === platform);
    };

    const handlePublish = async () => {
        if (platforms.length === 0) {
            setMessage({ type: 'error', text: 'Please select at least one platform to publish to.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            const res = await fetch("/api/social/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    assetUrl,
                    assetId,
                    caption,
                    platforms,
                    mediaType,
                    scheduledFor: isScheduling ? scheduledFor : undefined
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to publish");
            }

            setMessage({ type: 'success', text: isScheduling ? "Successfully scheduled!" : "Successfully published!" });
            setTimeout(() => {
                onClose();
            }, 2000);

        } catch (e: any) {
            setMessage({ type: 'error', text: e.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
            onClick={(e) => {
                e.stopPropagation();
                onClose();
            }}
        >
            <div
                className="relative w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/5">
                    <h2 className="text-xl font-bold text-white">Publish to Socials</h2>
                    <button type="button" onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex flex-col md:flex-row flex-1 overflow-y-auto min-h-0">

                    {/* Media Preview (Left) */}
                    <div className="md:w-5/12 bg-black border-r border-white/10 flex flex-col p-4 items-center justify-center min-h-[250px] md:min-h-0 relative">
                        {mediaType === "video" ? (
                            <video src={assetUrl} className="max-h-full max-w-full rounded-lg border border-white/10 object-contain shadow-md" controls autoPlay loop muted playsInline />
                        ) : (
                            <div className="relative w-full h-full min-h-[200px]">
                                <Image src={assetUrl} alt="Preview" fill className="object-contain rounded-lg drop-shadow-lg" unoptimized />
                            </div>
                        )}
                    </div>

                    {/* Compose Area (Right) */}
                    <div className="md:w-7/12 p-6 flex flex-col">

                        {/* Status Message */}
                        {message && (
                            <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 text-sm ${message.type === 'success' ? 'bg-[#B7FF00]/10 border border-[#B7FF00]/20 text-[#B7FF00]' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                {message.type === 'success' ? <Check size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                                <span>{message.text}</span>
                            </div>
                        )}

                        <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">Write Caption</label>
                        <textarea
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Write an engaging caption..."
                            className="w-full h-32 bg-white/5 border border-white/20 rounded-xl p-4 text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-[#B7FF00] focus:ring-1 focus:ring-[#B7FF00] text-sm mb-6 transition-all"
                        />

                        <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-3">Select Platforms</label>

                        {fetchingAccounts ? (
                            <div className="flex items-center gap-2 text-white/50 text-sm">
                                <Loader2 className="animate-spin w-4 h-4" /> Fetching connected accounts...
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 mb-6">
                                {/* Instagram */}
                                <label
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (hasAccountFor('instagram')) togglePlatform("instagram"); }}
                                    className={`flex items-center justify-between p-3 rounded-xl border ${platforms.includes("instagram") ? 'border-[#B7FF00] bg-[#B7FF00]/5' : 'border-white/10 bg-black'} cursor-pointer transition-colors ${!hasAccountFor('instagram') && 'opacity-50 cursor-not-allowed'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs">IG</div>
                                        <div>
                                            <p className="font-bold text-white text-sm">Instagram</p>
                                            {!hasAccountFor('instagram') && <p className="text-[10px] text-white/40">Not connected - Link in Settings</p>}
                                        </div>
                                    </div>
                                    {hasAccountFor('instagram') && (
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${platforms.includes('instagram') ? 'bg-[#B7FF00] border-[#B7FF00] text-black' : 'border-white/30 bg-transparent'}`}>
                                            {platforms.includes('instagram') && <Check size={14} strokeWidth={3} />}
                                        </div>
                                    )}
                                </label>

                                {/* Facebook */}
                                <label
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (hasAccountFor('facebook')) togglePlatform("facebook"); }}
                                    className={`flex items-center justify-between p-3 rounded-xl border ${platforms.includes("facebook") ? 'border-[#B7FF00] bg-[#B7FF00]/5' : 'border-white/10 bg-black'} cursor-pointer transition-colors ${!hasAccountFor('facebook') && 'opacity-50 cursor-not-allowed'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">FB</div>
                                        <div>
                                            <p className="font-bold text-white text-sm">Facebook Page</p>
                                            {!hasAccountFor('facebook') && <p className="text-[10px] text-white/40">Not connected - Link in Settings</p>}
                                        </div>
                                    </div>
                                    {hasAccountFor('facebook') && (
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${platforms.includes('facebook') ? 'bg-[#B7FF00] border-[#B7FF00] text-black' : 'border-white/30 bg-transparent'}`}>
                                            {platforms.includes('facebook') && <Check size={14} strokeWidth={3} />}
                                        </div>
                                    )}
                                </label>

                                {/* TikTok */}
                                {/*
                                <label
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (hasAccountFor('tiktok')) togglePlatform("tiktok"); }}
                                    className={`flex items-center justify-between p-3 rounded-xl border ${platforms.includes("tiktok") ? 'border-[#B7FF00] bg-[#B7FF00]/5' : 'border-white/10 bg-black'} cursor-pointer transition-colors ${!hasAccountFor('tiktok') && 'opacity-50 cursor-not-allowed'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-black border border-white/20 flex items-center justify-center text-white font-bold text-xs">TK</div>
                                        <div>
                                            <p className="font-bold text-white text-sm">TikTok</p>
                                            {!hasAccountFor('tiktok') && <p className="text-[10px] text-white/40">Not connected - Link in Settings</p>}
                                        </div>
                                    </div>
                                    {hasAccountFor('tiktok') && (
                                        <input
                                            type="checkbox"
                                            checked={platforms.includes("tiktok")}
                                            readOnly
                                            className="w-5 h-5 accent-[#B7FF00] rounded"
                                        />
                                    )}
                                </label>
                                */}
                            </div>
                        )}

                        {isScheduling ? (
                            <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-3">
                                <label className="block text-xs font-bold uppercase tracking-wider text-white/50">Select Date & Time</label>
                                <input
                                    type="datetime-local"
                                    value={scheduledFor}
                                    onChange={(e) => setScheduledFor(e.target.value)}
                                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#B7FF00] mb-2"
                                />
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsScheduling(false)}
                                        className="px-4 py-3 border border-white/20 hover:border-white/50 bg-transparent text-white rounded-xl transition text-sm font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePublish}
                                        disabled={loading || platforms.length === 0 || !scheduledFor}
                                        className="flex-1 bg-[#B7FF00] text-black font-bold py-3 rounded-xl hover:bg-[#caff33] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-4 h-4" />}
                                        Confirm Schedule
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-auto pt-4 border-t border-white/10 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handlePublish}
                                    disabled={loading || platforms.length === 0}
                                    className="flex-1 bg-[#B7FF00] text-black font-bold py-3 rounded-xl hover:bg-[#caff33] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Publish Now
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsScheduling(true)}
                                    className="flex items-center justify-center gap-2 px-4 py-3 border border-white/20 hover:border-[#B7FF00] bg-white/5 text-white rounded-xl transition text-sm font-bold"
                                >
                                    <Calendar className="w-4 h-4" />
                                    Schedule
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
